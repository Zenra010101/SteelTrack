using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SteelTrack.Application.DTOs.Products;
using SteelTrack.Application.Interfaces;
using SteelTrack.Infrastructure.Settings;

namespace SteelTrack.Infrastructure.Services;

/// <summary>
/// Produces demand forecasts from the Python LSTM forecasting service.
///
/// The forecasting service predicts per (product, branch) pair. This class
/// aggregates those rows into one row per (product, month) by summing
/// across branches, which is the shape the forecasting UI consumes.
///
/// When the forecasting service cannot be reached, or returns nothing for a
/// requested month, the legacy seasonal estimate (owned by
/// IProductService) is used for that row and the row is marked so the
/// client can tell the difference.
/// </summary>
public sealed class LstmForecastService : ILstmForecastService
{
    private readonly IProductService _productService;
    private readonly ILstmForecastClient _client;
    private readonly LstmServiceSettings _settings;
    private readonly ILogger<LstmForecastService> _logger;

    public LstmForecastService(
        IProductService productService,
        ILstmForecastClient client,
        IOptions<LstmServiceSettings> settings,
        ILogger<LstmForecastService> logger)
    {
        _productService = productService;
        _client = client;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task<LstmForecastResponse> GetForecastAsync(
        DateTime fromMonth,
        DateTime toMonth,
        Guid? categoryId,
        Guid? branchId = null,
        CancellationToken cancellationToken = default)
    {
        var startMonth = new DateTime(fromMonth.Year, fromMonth.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var endMonth = new DateTime(toMonth.Year, toMonth.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        if (endMonth < startMonth)
            (startMonth, endMonth) = (endMonth, startMonth);

        // The legacy estimate is the fallback for any month the forecasting
        // service does not cover. Computing it up front keeps a single
        // source of truth for the estimate instead of duplicating the
        // seasonal maths here.
        var legacyRows = await _productService.GetLstmForecastAsync(
            startMonth, endMonth, categoryId, branchId, cancellationToken);

        var legacyByKey = legacyRows.ToDictionary(
            r => (r.ProductId, Month: r.Month),
            r => r);

        var months = BuildMonthList(startMonth, endMonth);

        // The forecasting service only projects forward from the current
        // month, so asking for the whole range would make it compute (and
        // return) months nobody asked for. Asking for the configured
        // horizon keeps the response to the months that can actually be
        // forecast; the earlier months of the range fall back to the
        // legacy estimate below.
        var forecastableMonths = months.Count(m => m > DateTime.UtcNow.AddDays(-1));
        var horizon = Math.Clamp(
            Math.Min(forecastableMonths, _settings.HorizonMonths),
            1,
            12);

        var outcome = await _client.GetPredictionsAsync(
            new LstmPredictRequest
            {
                ProductIds = null,
                BranchIds = branchId.HasValue ? [branchId.Value] : null,
                HorizonMonths = horizon,
            },
            cancellationToken);

        var serviceResponse = outcome.Response;
        var serviceRows = serviceResponse?.Predictions ?? [];

        // Index the service rows by (product, month) so each requested month
        // resolves to the aggregate the service produced.
        var byProductMonth = serviceRows
            .GroupBy(r => (r.ProductId, Month: r.ForecastMonth.ToDateTime(TimeOnly.MinValue).ToString("yyyy-MM")))
            .ToDictionary(
                g => g.Key,
                g => new AggregatedRow
                {
                    Quantity = g.Sum(r => r.PredictedQuantity),
                    Lower = g.Sum(r => r.ConfidenceLower),
                    Upper = g.Sum(r => r.ConfidenceUpper),
                    Trend = ResolveTrend(g.Select(r => r.Trend)),
                    Source = g.All(r => r.Source == "lstm") ? "lstm" : "seasonal_naive",
                    ModelVersion = g.First().ModelVersion,
                    Mismatches = g.Count(r => r.Source != "lstm"),
                });

        var serviceReachable = serviceResponse is not null;
        var totalMismatches = 0;
        var modelServedCount = 0;
        var fallbackCount = 0;
        var forecastWindowCount = 0;
        var forecastFallbackCount = 0;

        var forecasts = new List<LstmForecastDto>();

        // The forecasting service projects forward from the current month, so
        // only months from this one on can ever be served by the model. The
        // legacy rows carry "YYYY-MM", and the same format sorts correctly
        // as text.
        var currentMonthKey = DateTime.UtcNow.ToString("yyyy-MM");

        foreach (var legacy in legacyRows)
        {
            // The history months in the window are never model-eligible and
            // would distort the coverage percentage.
            var isForecastRegion = string.CompareOrdinal(legacy.Month, currentMonthKey) >= 0;

            if (!byProductMonth.TryGetValue((legacy.ProductId, legacy.Month), out var aggregate))
            {
                // No model row for this (product, month): either the service
                // is down, or it does not forecast this (historical) month.
                legacy.Source = "fallback";
                legacy.ModelVersion = "legacy-estimate";
                legacy.ServiceFallback = !serviceReachable;
                fallbackCount++;
                if (isForecastRegion)
                {
                    forecastWindowCount++;
                    forecastFallbackCount++;
                }
                forecasts.Add(legacy);
                continue;
            }

            totalMismatches += aggregate.Mismatches;
            modelServedCount++;
            if (isForecastRegion) forecastWindowCount++;

            forecasts.Add(new LstmForecastDto
            {
                ProductId = legacy.ProductId,
                ProductSku = legacy.ProductSku,
                ProductName = legacy.ProductName,
                CategoryId = legacy.CategoryId,
                CategoryName = legacy.CategoryName,
                ParentCategoryId = legacy.ParentCategoryId,
                ParentCategoryName = legacy.ParentCategoryName,
                Month = legacy.Month,
                PredictedQuantity = aggregate.Quantity,
                PredictedRevenue = aggregate.Quantity * UnitPriceOf(legacy),
                ConfidenceInterval = ConfidenceFromBand(aggregate.Lower, aggregate.Upper, aggregate.Quantity),
                ConfidenceLower = aggregate.Lower,
                ConfidenceUpper = aggregate.Upper,
                ActualQuantity = legacy.ActualQuantity,
                Trend = aggregate.Trend,
                Source = aggregate.Source,
                ModelVersion = aggregate.ModelVersion,
                ServiceFallback = false,
                SourceMismatchCount = aggregate.Mismatches,
                CurrentStock = legacy.CurrentStock,
                ReorderLevel = legacy.ReorderLevel,
                RecommendedRestock = legacy.RecommendedRestock,
                PlanningStatus = legacy.PlanningStatus,
            });
        }

        var sorted = forecasts
            .OrderByDescending(f => f.PredictedQuantity)
            .ThenBy(f => f.ProductName)
            .ToList();

        return new LstmForecastResponse
        {
            Count = sorted.Count,
            ModelVersion = serviceResponse?.ModelVersion ?? "legacy-estimate",
            ServiceReachable = serviceReachable,
            ServiceStatusCode = outcome.StatusCode,
            ServiceError = outcome.ErrorMessage,
            // Forecast-region rows only. The history months in the window are
            // never model-eligible, so counting them would make the coverage
            // percentage meaningless.
            ForecastWindowCount = forecastWindowCount,
            ForecastFallbackCount = forecastFallbackCount,
            // Any row that did not come from the trained model counts as a
            // fallback. The service only forecasts the products it has a
            // model for, so a catalogue with products that have no sales
            // history is partly served — that has to be visible, not just
            // the all-or-nothing case of the service being down.
            ServiceFallback = !serviceReachable || fallbackCount > 0,
            SourceMismatchCount = totalMismatches,
            ModelServedCount = modelServedCount,
            FallbackCount = fallbackCount,
            Forecasts = sorted,
        };
    }

    /// <summary>
    /// Recover the unit price the legacy row was valued at, so the
    /// service-served quantity can be re-valued without a second lookup.
    /// </summary>
    private static decimal UnitPriceOf(LstmForecastDto legacy) =>
        legacy.PredictedQuantity > 0
            ? legacy.PredictedRevenue / legacy.PredictedQuantity
            : 0m;

    // ------------------------------------------------------------------
    private static List<DateTime> BuildMonthList(DateTime startMonth, DateTime endMonth)
    {
        var months = new List<DateTime>();
        var current = startMonth;
        while (current <= endMonth && months.Count < 36)
        {
            months.Add(current);
            current = current.AddMonths(1);
        }
        return months;
    }

    /// <summary>
    /// Turn a confidence band into a 0..1 confidence score. A narrow band
    /// around the point forecast means a more trustworthy forecast.
    /// </summary>
    private static double ConfidenceFromBand(int lower, int upper, int point)
    {
        var width = Math.Max(0, upper - lower);
        var scale = Math.Max(1, point);
        var relativeWidth = width / (2.0 * scale);
        return Math.Round(Math.Clamp(1.0 / (1.0 + relativeWidth), 0.0, 1.0), 4);
    }

    private static string ResolveTrend(IEnumerable<string> trends)
    {
        var list = trends.ToList();
        if (list.Count == 0) return "stable";
        if (list.Any(t => t == "up")) return "up";
        if (list.Any(t => t == "down")) return "down";
        return "stable";
    }

    // ------------------------------------------------------------------
    private sealed class AggregatedRow
    {
        public int Quantity { get; init; }
        public int Lower { get; init; }
        public int Upper { get; init; }
        public string Trend { get; init; } = "stable";
        public string Source { get; init; } = "unknown";
        public string ModelVersion { get; init; } = "unknown";
        public int Mismatches { get; init; }
    }
}

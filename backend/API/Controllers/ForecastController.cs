using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SteelTrack.Application.Common;
using SteelTrack.Application.DTOs.Products;
using SteelTrack.Application.Interfaces;
using SteelTrack.Domain.Constants;
using SteelTrack.Infrastructure.Persistence;
using SteelTrack.Infrastructure.Services;

namespace SteelTrack.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ForecastController : ControllerBase
{
    private readonly ILstmForecastService _lstmForecastService;
    private readonly ILstmForecastClient _lstmForecastClient;
    private readonly AppDbContext _context;
    private readonly ILogger<ForecastController> _logger;

    public ForecastController(
        ILstmForecastService lstmForecastService,
        ILstmForecastClient lstmForecastClient,
        AppDbContext context,
        ILogger<ForecastController> logger)
    {
        _lstmForecastService = lstmForecastService;
        _lstmForecastClient = lstmForecastClient;
        _context = context;
        _logger = logger;
    }

    public class GenerateForecastRequest
    {
        public Guid? BranchId { get; set; }
        public List<Guid>? ProductIds { get; set; }
        public int HorizonMonths { get; set; } = 3;
        public string? ModelVersion { get; set; }
    }

    /// <summary>
    /// Triggers LSTM inference via the Python microservice or orchestrates
    /// graceful service-layer fallback if Python is temporarily unreachable.
    /// </summary>
    [HttpPost("generate")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GenerateForecast(
        [FromBody] GenerateForecastRequest request,
        CancellationToken cancellationToken)
    {
        if (request == null)
        {
            return BadRequest(ApiResponse<string>.Fail("Forecast request body cannot be null."));
        }

        var horizon = Math.Clamp(request.HorizonMonths, 1, 12);

        _logger.LogInformation(
            "Generating forecast: branch={BranchId}, productsCount={Count}, horizon={Horizon}, model={Model}",
            request.BranchId,
            request.ProductIds?.Count ?? 0,
            horizon,
            request.ModelVersion ?? "auto");

        // 1. Attempt inference via Python LSTM microservice
        var predictRequest = new LstmPredictRequest
        {
            BranchIds = request.BranchId.HasValue ? [request.BranchId.Value] : null,
            ProductIds = request.ProductIds,
            HorizonMonths = horizon,
            ModelVersion = request.ModelVersion
        };

        var outcome = await _lstmForecastClient.GetPredictionsAsync(predictRequest, cancellationToken);

        if (outcome.Succeeded && outcome.Response != null)
        {
            return Ok(new
            {
                success = true,
                source = "python_lstm",
                modelVersion = outcome.Response.ModelVersion,
                generatedAt = outcome.Response.GeneratedAt ?? DateTime.UtcNow.ToString("o"),
                count = outcome.Response.Count,
                data = outcome.Response.Predictions
            });
        }

        // 2. Python service unreachable or errored - Log cleanly and orchestrate service fallback
        _logger.LogWarning(
            "Python LSTM microservice could not complete inference (TransportFailure: {TransportFailure}, StatusCode: {StatusCode}, Error: {Error}). Falling back to service layer.",
            outcome.TransportFailure,
            outcome.StatusCode,
            outcome.ErrorMessage);

        var now = DateTime.UtcNow;
        var fromMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(-6);
        var toMonth = fromMonth.AddMonths(horizon + 6);

        var fallbackResponse = await _lstmForecastService.GetForecastAsync(
            fromMonth,
            toMonth,
            categoryId: null,
            branchId: request.BranchId,
            modelVersion: request.ModelVersion,
            cancellationToken: cancellationToken);

        return Ok(new
        {
            success = true,
            source = "service_fallback",
            modelVersion = fallbackResponse.ModelVersion,
            generatedAt = DateTime.UtcNow.ToString("o"),
            count = fallbackResponse.Forecasts.Count,
            diagnostics = new
            {
                serviceReachable = fallbackResponse.ServiceReachable,
                serviceStatusCode = fallbackResponse.ServiceStatusCode,
                serviceError = fallbackResponse.ServiceError ?? outcome.ErrorMessage,
                modelServedCount = fallbackResponse.ModelServedCount,
                fallbackCount = fallbackResponse.FallbackCount
            },
            data = fallbackResponse.Forecasts
        });
    }

    /// <summary>
    /// Retrieves forecast time-series for a specific branch facility.
    /// </summary>
    [HttpGet("branch/{branchId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetBranchForecast(
        Guid branchId,
        [FromQuery] int horizonMonths = 3,
        [FromQuery] Guid? categoryId = null,
        [FromQuery] string? modelVersion = null,
        CancellationToken cancellationToken = default)
    {
        var branchExists = await _context.Branches.AsNoTracking().AnyAsync(b => b.Id == branchId, cancellationToken);
        if (!branchExists)
        {
            return NotFound(ApiResponse<string>.Fail($"Branch facility with id '{branchId}' was not found."));
        }

        var horizon = Math.Clamp(horizonMonths, 1, 12);
        var now = DateTime.UtcNow;
        var fromMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(-6);
        var toMonth = fromMonth.AddMonths(horizon + 6);

        var forecast = await _lstmForecastService.GetForecastAsync(
            fromMonth,
            toMonth,
            categoryId,
            branchId,
            modelVersion,
            cancellationToken);

        return Ok(ApiResponse<LstmForecastResponse>.Ok(forecast));
    }

    /// <summary>
    /// Returns live diagnostics on the Python LSTM forecasting pipeline and database state.
    /// </summary>
    [HttpGet("diagnostics")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDiagnostics(CancellationToken cancellationToken)
    {
        var isHealthy = await _lstmForecastClient.IsHealthyAsync(cancellationToken);
        var activeProducts = await _context.Products.AsNoTracking().CountAsync(p => p.IsActive, cancellationToken);
        var totalBranches = await _context.Branches.AsNoTracking().CountAsync(cancellationToken);

        return Ok(new
        {
            success = true,
            timestamp = DateTime.UtcNow,
            service = new
            {
                name = "SteelTrack LSTM Forecasting Pipeline",
                isReachable = isHealthy,
                status = isHealthy ? "Online" : "Offline / Unreachable",
                recommendedAction = isHealthy ? "Normal operation" : "Verify python microservice is running on port 8000"
            },
            database = new
            {
                activeProductsCount = activeProducts,
                branchesCount = totalBranches
            }
        });
    }

    /// <summary>
    /// Catalog-wide demand forecast across all active products.
    /// </summary>
    [HttpGet("catalog")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCatalogForecast(
        [FromQuery] string? fromMonth,
        [FromQuery] string? toMonth,
        [FromQuery] Guid? categoryId,
        [FromQuery] Guid? branchId,
        [FromQuery] string? modelVersion,
        CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var parsedFrom = ParseMonthParam(fromMonth, now.AddMonths(-6));
        var parsedTo = ParseMonthParam(toMonth, now.AddMonths(3));

        var forecast = await _lstmForecastService.GetForecastAsync(
            parsedFrom, parsedTo, categoryId, branchId, modelVersion, cancellationToken);

        return Ok(ApiResponse<LstmForecastResponse>.Ok(forecast));
    }

    private static DateTime ParseMonthParam(string? value, DateTime fallback)
    {
        if (string.IsNullOrWhiteSpace(value)) return new DateTime(fallback.Year, fallback.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        if (DateTime.TryParse(value, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var dt))
            return new DateTime(dt.Year, dt.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        if (value.Length == 7 && DateTime.TryParse(value + "-01", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out dt))
            return new DateTime(dt.Year, dt.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        return new DateTime(fallback.Year, fallback.Month, 1, 0, 0, 0, DateTimeKind.Utc);
    }
}

using System.Net.Http.Json;
using System.Net.Http;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SteelTrack.Infrastructure.Settings;

namespace SteelTrack.Infrastructure.Services;

/// <summary>
/// Wire contract for the Python LSTM forecasting service.
/// </summary>
public sealed class LstmPredictRequest
{
    [JsonPropertyName("product_ids")]
    public List<Guid>? ProductIds { get; set; }

    [JsonPropertyName("branch_ids")]
    public List<Guid>? BranchIds { get; set; }

    [JsonPropertyName("horizon_months")]
    public int HorizonMonths { get; set; } = 3;

    [JsonPropertyName("model_version")]
    public string? ModelVersion { get; set; }
}

public sealed class LstmPredictResponse
{
    [JsonPropertyName("predictions")]
    public List<LstmPredictionDto> Predictions { get; set; } = [];

    [JsonPropertyName("model_version")]
    public string ModelVersion { get; set; } = "unknown";

    [JsonPropertyName("generated_at")]
    public string? GeneratedAt { get; set; }

    [JsonPropertyName("count")]
    public int Count { get; set; }
}

public sealed class LstmPredictionDto
{
    [JsonPropertyName("product_id")]
    public Guid ProductId { get; set; }

    [JsonPropertyName("product_sku")]
    public string ProductSku { get; set; } = "";

    [JsonPropertyName("product_name")]
    public string ProductName { get; set; } = "";

    [JsonPropertyName("branch_id")]
    public Guid BranchId { get; set; }

    [JsonPropertyName("branch_code")]
    public string BranchCode { get; set; } = "";

    [JsonPropertyName("forecast_month")]
    public DateOnly ForecastMonth { get; set; }

    [JsonPropertyName("predicted_quantity")]
    public int PredictedQuantity { get; set; }

    [JsonPropertyName("confidence_lower")]
    public int ConfidenceLower { get; set; }

    [JsonPropertyName("confidence_upper")]
    public int ConfidenceUpper { get; set; }

    [JsonPropertyName("trend")]
    public string Trend { get; set; } = "stable";

    [JsonPropertyName("model_version")]
    public string ModelVersion { get; set; } = "unknown";

    /// <summary>"lstm" when the trained model served the row; "seasonal_naive"
    /// when the service fell back for a series with no trained model.</summary>
    [JsonPropertyName("source")]
    public string Source { get; set; } = "unknown";
}

/// <summary>
/// The result of asking the forecasting service for predictions.
///
/// A plain nullable response cannot tell "the service is down" from "the
/// service answered 401 because our API key is wrong" — and that difference
/// decides what the user should be told and what they should fix.
/// </summary>
public sealed class LstmPredictOutcome
{
    /// <summary>The service's answer, when it produced one.</summary>
    public LstmPredictResponse? Response { get; init; }

    /// <summary>True when the request never completed (connection refused, timeout).</summary>
    public bool TransportFailure { get; init; }

    /// <summary>HTTP status the service answered with, when it answered at all.</summary>
    public int? StatusCode { get; init; }

    /// <summary>Short excerpt of the service's error message, when it failed.</summary>
    public string? ErrorMessage { get; init; }

    /// <summary>True when the service produced a usable answer.</summary>
    public bool Succeeded => Response is not null && !TransportFailure;
}

/// <summary>
/// Typed HTTP client for the Python LSTM forecasting service.
/// </summary>
public interface ILstmForecastClient
{
    Task<LstmPredictOutcome> GetPredictionsAsync(
        LstmPredictRequest request,
        CancellationToken cancellationToken = default);

    Task<bool> IsHealthyAsync(CancellationToken cancellationToken = default);
}

public sealed class LstmForecastClient : ILstmForecastClient
{
    /// <summary>Header the forecasting service checks for the shared secret.</summary>
    private const string ApiKeyHeader = "X-LSTM-API-KEY";

    private readonly HttpClient _http;
    private readonly LstmServiceSettings _settings;
    private readonly ILogger<LstmForecastClient> _logger;

    public LstmForecastClient(
        HttpClient http,
        IOptions<LstmServiceSettings> settings,
        ILogger<LstmForecastClient> logger)
    {
        _http = http;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task<bool> IsHealthyAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            using var response = await _http.GetAsync("/health", cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _logger.LogDebug(ex, "LSTM service health probe failed");
            return false;
        }
    }

    public async Task<LstmPredictOutcome> GetPredictionsAsync(
        LstmPredictRequest request,
        CancellationToken cancellationToken = default)
    {
        try
        {
            // POST rather than GET: a scope of several hundred product
            // UUIDs is a ~30 KB query string, which is not a reasonable
            // thing to put in a URL.
            using var message = new HttpRequestMessage(HttpMethod.Post, "/predict")
            {
                Content = JsonContent.Create(request),
            };

            // The service rejects a request without the shared secret, so
            // the header has to ride along on every call.
            message.Headers.TryAddWithoutValidation(ApiKeyHeader, _settings.ApiKey);

            using var response = await _http.SendAsync(message, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogWarning(
                    "LSTM service returned {StatusCode} for POST /predict: {Body}",
                    (int)response.StatusCode,
                    body.Length > 500 ? body[..500] : body);

                // The service answered, it just did not like the request.
                // A 401 here means the shared API key is wrong; a 503 means
                // it has no trained model. Those are different problems from
                // the process being down, so they are reported differently.
                return new LstmPredictOutcome
                {
                    StatusCode = (int)response.StatusCode,
                    ErrorMessage = Excerpt(body),
                };
            }

            var parsed = await response.Content.ReadFromJsonAsync<LstmPredictResponse>(
                cancellationToken: cancellationToken);

            if (parsed is null)
            {
                return new LstmPredictOutcome
                {
                    StatusCode = (int)response.StatusCode,
                    ErrorMessage = "The service returned an empty response body.",
                };
            }

            return new LstmPredictOutcome { Response = parsed };
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _logger.LogWarning(ex, "LSTM service is unreachable");

            // The request never completed, so there is no HTTP status to
            // report — only that the service could not be reached.
            return new LstmPredictOutcome { TransportFailure = true };
        }
    }

    /// <summary>
    /// Trim a service error body down to something worth putting in a UI.
    /// </summary>
    private static string? Excerpt(string body)
    {
        if (string.IsNullOrWhiteSpace(body)) return null;

        var trimmed = body.Trim();
        return trimmed.Length > 300 ? trimmed[..300] : trimmed;
    }
}

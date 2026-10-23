namespace SteelTrack.Application.DTOs.Products;

/// <summary>
/// Response for the LSTM forecast endpoint. Wraps the forecast rows with
/// enough metadata for the client to tell a real model forecast apart
/// from a legacy estimate.
/// </summary>
public sealed class LstmForecastResponse
{
    public int Count { get; set; }

    /// <summary>Model version that produced the forecasts.</summary>
    public string ModelVersion { get; set; } = "unknown";

    /// <summary>True when the forecasting service answered the request.</summary>
    public bool ServiceReachable { get; set; }

    /// <summary>
    /// True when the forecasting service could not be reached and the rows
    /// below come from the legacy seasonal estimate.
    /// </summary>
    public bool ServiceFallback { get; set; }

    /// <summary>
    /// Number of (product, branch) rows the service answered with the
    /// seasonal-naive fallback rather than the trained model.
    /// </summary>
    public int SourceMismatchCount { get; set; }

    /// <summary>
    /// Number of rows in the forecast window that the trained model served.
    /// </summary>
    public int ModelServedCount { get; set; }

    /// <summary>
    /// Number of rows in the forecast window that fell back to the legacy
    /// seasonal estimate. A row falls back when the forecasting service
    /// could not produce a model for that product — typically because the
    /// product has no sales history to train on.
    /// </summary>
    public int FallbackCount { get; set; }

    /// <summary>
    /// HTTP status the forecasting service answered with, or null when it
    /// never answered at all. 401 means it rejected the shared API key, 503
    /// means it has no trained model, 5xx means it failed.
    /// </summary>
    public int? ServiceStatusCode { get; set; }

    /// <summary>
    /// Short excerpt of the forecasting service's error message, when it
    /// answered with an error.
    /// </summary>
    public string? ServiceError { get; set; }

    /// <summary>
    /// Number of rows in the forecast region of the window — the months the
    /// forecasting service can actually project forward. Rows in the history
    /// part of the window are never model-eligible, so counting them would
    /// make the model-coverage percentage meaningless.
    /// </summary>
    public int ForecastWindowCount { get; set; }

    /// <summary>
    /// Number of forecast-region rows that fell back to the legacy estimate.
    /// </summary>
    public int ForecastFallbackCount { get; set; }

    public IReadOnlyList<LstmForecastDto> Forecasts { get; set; } = [];
}

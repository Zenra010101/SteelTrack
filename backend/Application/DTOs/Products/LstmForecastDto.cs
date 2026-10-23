namespace SteelTrack.Application.DTOs.Products;

public sealed class LstmForecastDto
{
    // --- Identity -------------------------------------------------------
    public Guid ProductId { get; set; }
    public string ProductSku { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public Guid CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public Guid? ParentCategoryId { get; set; }
    public string? ParentCategoryName { get; set; }
    public string Month { get; set; } = string.Empty; // Format: "YYYY-MM"

    // --- Forecast -------------------------------------------------------
    public int PredictedQuantity { get; set; }
    public decimal PredictedRevenue { get; set; }
    public double ConfidenceInterval { get; set; }

    /// <summary>
    /// Lower bound of the 95% confidence band, in units. For rows the
    /// legacy estimate produced there is no band, so this equals
    /// <see cref="PredictedQuantity"/>.
    /// </summary>
    public int ConfidenceLower { get; set; }

    /// <summary>
    /// Upper bound of the 95% confidence band, in units.
    /// </summary>
    public int ConfidenceUpper { get; set; }

    /// <summary>
    /// Units actually sold in this month. Zero for future months, which
    /// have not happened yet.
    /// </summary>
    public int ActualQuantity { get; set; }

    public string Trend { get; set; } = "stable"; // "up", "down", "stable"

    /// <summary>
    /// Which engine produced this row: "lstm" when the trained model served
    /// it, "seasonal_naive" when the forecasting service fell back for a
    /// series with no trained model, and "fallback" when the forecasting
    /// service could not be reached at all and the legacy estimate was used.
    /// </summary>
    public string Source { get; set; } = "unknown";

    /// <summary>Model version that served this row.</summary>
    public string ModelVersion { get; set; } = "unknown";

    /// <summary>
    /// True when the forecasting service was unreachable and this row came
    /// from the legacy seasonal estimate rather than a trained model.
    /// </summary>
    public bool ServiceFallback { get; set; }

    /// <summary>
    /// Number of (product, branch) rows behind this aggregate that the
    /// service answered with the seasonal-naive fallback rather than the
    /// trained model. Zero means every contributing row was model-served.
    /// </summary>
    public int SourceMismatchCount { get; set; }

    // --- Inventory planning ---------------------------------------------
    public int CurrentStock { get; set; }
    public int ReorderLevel { get; set; }
    public int RecommendedRestock { get; set; }
    public string PlanningStatus { get; set; } = "Optimal"; // "Restock Needed", "Optimal", "Overstocked"
}

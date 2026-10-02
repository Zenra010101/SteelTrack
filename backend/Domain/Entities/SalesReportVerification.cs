namespace SteelTrack.Domain.Entities;

public class SalesReportVerification
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public string ReportCode { get; set; } = string.Empty;
    public string Preset { get; set; } = string.Empty;
    public string PeriodLabel { get; set; } = string.Empty;
    public DateTime FromDate { get; set; } = DateTime.UtcNow;
    public DateTime ToDate { get; set; } = DateTime.UtcNow;
    public decimal GrossSales { get; set; } = 0m;
    public decimal NetSales { get; set; } = 0m;
    public decimal TotalLineAmount { get; set; } = 0m;
    public string PrintedAtLabel { get; set; } = string.Empty;
    public DateTime PrintedAtUtc { get; set; } = DateTime.UtcNow;
    public string? StoreName { get; set; }
    public string? GeneratedByUserId { get; set; }
}

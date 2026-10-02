namespace SteelTrack.Domain.Entities;

public class SalesReturnDeduction
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string GoodsReturnSlipId { get; set; } = string.Empty;
    public GoodsReturnSlip GoodsReturnSlip { get; set; } = null!;
    public string OriginalSaleId { get; set; } = string.Empty;
    public string OriginalInvoiceNumber { get; set; } = string.Empty;
    public DateTime DeductionDate { get; set; } = DateTime.UtcNow;
    public DateTime OriginalSaleDate { get; set; } = DateTime.UtcNow;
    public decimal Amount { get; set; } = 0m;
    public string ProcessedByUserId { get; set; } = string.Empty;
    public User ProcessedByUser { get; set; } = null!;
    public bool IsReversed { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

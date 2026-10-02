namespace SteelTrack.Domain.Entities;

public class InventoryAdjustmentRequestLine
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public string InventoryAdjustmentRequestId { get; set; } = string.Empty;
    public InventoryAdjustmentRequest InventoryAdjustmentRequest { get; set; } = null!;
    public string ProductBatchId { get; set; } = string.Empty;
    public ProductBatch ProductBatch { get; set; } = null!;
    public int SystemQuantity { get; set; } = 0;
    public int ActualQuantity { get; set; } = 0;
    public int Difference { get; set; } = 0;
}

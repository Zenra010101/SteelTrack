namespace SteelTrack.Domain.Entities;

public class InventoryTransaction
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string ProductId { get; set; } = string.Empty;
    public Product Product { get; set; } = null!;
    public int Type { get; set; } = 0;
    public int Quantity { get; set; } = 0;
    public int StockBefore { get; set; } = 0;
    public int StockAfter { get; set; } = 0;
    public string? Reference { get; set; }
    public string? Notes { get; set; }
    public string? StockReceivingId { get; set; }
    public StockReceiving? StockReceiving { get; set; }
    public string? UserId { get; set; }
    public User? User { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public string? ProductBatchId { get; set; }
}

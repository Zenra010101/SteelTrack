namespace SteelTrack.Domain.Entities;

public class StockReceivingItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string StockReceivingId { get; set; } = string.Empty;
    public StockReceiving StockReceiving { get; set; } = null!;
    public string ProductId { get; set; } = string.Empty;
    public Product Product { get; set; } = null!;
    public int Quantity { get; set; } = 0;
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public int? ExpectedQuantity { get; set; }
    public decimal CostPrice { get; set; } = 0m;
    public string? Remarks { get; set; }
    public decimal SellingPrice { get; set; } = 0m;
}

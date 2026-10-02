namespace SteelTrack.Domain.Entities;

public class ProductBatch
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public string ProductId { get; set; } = string.Empty;
    public Product Product { get; set; } = null!;
    public string? BatchCode { get; set; }
    public decimal CostPrice { get; set; } = 0m;
    public decimal SellingPrice { get; set; } = 0m;
    public int Quantity { get; set; } = 0;
    public DateTime ReceivedDate { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;
    public string? StockReceivingId { get; set; }
    public StockReceiving? StockReceiving { get; set; }
    public int ReceivedQuantity { get; set; } = 0;
    public string? StockReceivingItemId { get; set; }
    public string? SupplierId { get; set; }
    public Supplier? Supplier { get; set; }
    public string? ReceivedByUserId { get; set; }
    public string? ApprovedByUserId { get; set; }

    public ICollection<InventoryAdjustmentRequestLine> AdjustmentLines { get; set; } = new List<InventoryAdjustmentRequestLine>();
}

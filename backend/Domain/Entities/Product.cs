namespace SteelTrack.Domain.Entities;

public class Product
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Sku { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Barcode { get; set; }
    public string? Size { get; set; }
    public string? Thickness { get; set; }
    public string? Length { get; set; }
    public string? Grade { get; set; }
    public string UnitOfMeasure { get; set; } = "pc";
    public decimal UnitPrice { get; set; } = 0m;
    public decimal CostPrice { get; set; } = 0m;
    public int StockQuantity { get; set; } = 0;
    public int ReorderLevel { get; set; } = 0;
    public bool IsActive { get; set; } = true;
    public string CategoryId { get; set; } = string.Empty;
    public Category Category { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    
    // Stainless steel product specification parameters
    public string? Diameter { get; set; }
    public string? Schedule { get; set; }
    public string? Width { get; set; }
    public string? Height { get; set; }
    public string? MaterialType { get; set; }
    public string? SupplierId { get; set; }
    public Supplier? Supplier { get; set; }

    public ICollection<ProductBatch> Batches { get; set; } = new List<ProductBatch>();
    public ICollection<SaleItem> SaleItems { get; set; } = new List<SaleItem>();
    public ICollection<InventoryAdjustmentRequest> InventoryAdjustmentRequests { get; set; } = new List<InventoryAdjustmentRequest>();
    public ICollection<StockReceivingItem> StockReceivingItems { get; set; } = new List<StockReceivingItem>();
    public ICollection<InventoryTransaction> InventoryTransactions { get; set; } = new List<InventoryTransaction>();
}

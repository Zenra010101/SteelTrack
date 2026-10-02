namespace SteelTrack.Domain.Entities;

public class SaleItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string SaleId { get; set; } = string.Empty;
    public Sale Sale { get; set; } = null!;
    public string ProductId { get; set; } = string.Empty;
    public Product Product { get; set; } = null!;
    public string ProductName { get; set; } = string.Empty;
    public string ProductSku { get; set; } = string.Empty;
    public int Quantity { get; set; } = 0;
    public decimal UnitPrice { get; set; } = 0m;
    public decimal SellingPriceAtSale { get; set; } = 0m;
    public decimal CostPriceAtSale { get; set; } = 0m;
    public decimal ProfitAmount { get; set; } = 0m;
    public decimal Discount { get; set; } = 0m;
    public decimal LineTotal { get; set; } = 0m;
    public int ReturnedQuantity { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public int PendingReturnQuantity { get; set; } = 0;
    public string? ProductBatchId { get; set; }
    public ProductBatch? ProductBatch { get; set; }
    public string? BatchCodeAtSale { get; set; }
    public DateTime? BatchReceivedDate { get; set; }

    public ICollection<GoodsReturnSlipItem> GoodsReturnSlipItems { get; set; } = new List<GoodsReturnSlipItem>();
}

namespace SteelTrack.Domain.Entities;

public class GoodsReturnSlipItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string GoodsReturnSlipId { get; set; } = string.Empty;
    public GoodsReturnSlip GoodsReturnSlip { get; set; } = null!;
    public string SaleItemId { get; set; } = string.Empty;
    public SaleItem SaleItem { get; set; } = null!;
    public string ProductId { get; set; } = string.Empty;
    public Product Product { get; set; } = null!;
    public string ProductName { get; set; } = string.Empty;
    public string ProductSku { get; set; } = string.Empty;
    public int Quantity { get; set; } = 0;
    public decimal UnitPrice { get; set; } = 0m;
    public decimal LineTotal { get; set; } = 0m;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public decimal SellingPriceAtSale { get; set; } = 0m;
    public int Condition { get; set; } = 0;
    public decimal CostPriceAtSale { get; set; } = 0m;
    public string? ProductBatchId { get; set; }
    public string? BatchCode { get; set; }
    public string? BatchReceivedDate { get; set; }
}

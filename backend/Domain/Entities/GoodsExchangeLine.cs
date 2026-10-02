namespace SteelTrack.Domain.Entities;

public class GoodsExchangeLine
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string GoodsExchangeId { get; set; } = string.Empty;
    public GoodsExchange GoodsExchange { get; set; } = null!;
    public string ProductId { get; set; } = string.Empty;
    public Product Product { get; set; } = null!;
    public string ProductName { get; set; } = string.Empty;
    public string ProductSku { get; set; } = string.Empty;
    public int Quantity { get; set; } = 0;
    public decimal UnitPrice { get; set; } = 0m;
    public decimal LineTotal { get; set; } = 0m;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

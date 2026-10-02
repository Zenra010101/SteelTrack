using SteelTrack.Domain.Enums;

namespace SteelTrack.Domain.Entities;

public class GoodsExchange
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string GoodsReturnSlipId { get; set; } = string.Empty;
    public GoodsReturnSlip GoodsReturnSlip { get; set; } = null!;
    public string ExchangeNumber { get; set; } = string.Empty;
    public decimal ReturnCreditTotal { get; set; } = 0m;
    public decimal ReplacementTotal { get; set; } = 0m;
    public decimal AmountPaid { get; set; } = 0m;
    public PaymentMethod? PaymentMethod { get; set; }
    public string? TopUpSaleId { get; set; }
    public Sale? TopUpSale { get; set; }
    public DateTime CompletedAt { get; set; } = DateTime.UtcNow;
    public string CompletedByUserId { get; set; } = string.Empty;
    public User CompletedByUser { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public ICollection<GoodsExchangeLine> Lines { get; set; } = new List<GoodsExchangeLine>();
}

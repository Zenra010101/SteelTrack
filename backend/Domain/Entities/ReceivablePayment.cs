using SteelTrack.Domain.Enums;

namespace SteelTrack.Domain.Entities;

public class ReceivablePayment
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string CustomerReceivableId { get; set; } = string.Empty;
    public CustomerReceivable CustomerReceivable { get; set; } = null!;
    public decimal Amount { get; set; } = 0m;
    public decimal BalanceBefore { get; set; } = 0m;
    public decimal BalanceAfter { get; set; } = 0m;
    public DateTime PaymentDate { get; set; } = DateTime.UtcNow;
    public string? Reference { get; set; }
    public string? Notes { get; set; }
    public bool IsCredit { get; set; } = false;
    public string? GoodsReturnSlipId { get; set; }
    public GoodsReturnSlip? GoodsReturnSlip { get; set; }
    public string RecordedByUserId { get; set; } = string.Empty;
    public User RecordedByUser { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public PaymentMethod? PaymentMethod { get; set; }
    public bool IsChequePending { get; set; } = false;
    public bool IsVoided { get; set; } = false;
    public string? SaleChequeId { get; set; }
}

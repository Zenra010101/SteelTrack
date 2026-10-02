using SteelTrack.Domain.Enums;

namespace SteelTrack.Domain.Entities;

public class SalePayment
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string SaleId { get; set; } = string.Empty;
    public Sale Sale { get; set; } = null!;
    public PaymentMethod Method { get; set; } = PaymentMethod.Cash;
    public decimal Amount { get; set; } = 0m;
    public string? QrphReference { get; set; }
    public string? BankName { get; set; }
    public string? BankReferenceNumber { get; set; }
    public string? SenderName { get; set; }
    public DateTime? DatePaid { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public string? BankBranch { get; set; }
}

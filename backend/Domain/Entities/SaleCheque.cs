namespace SteelTrack.Domain.Entities;

public class SaleCheque
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string SaleId { get; set; } = string.Empty;
    public Sale Sale { get; set; } = null!;
    public int Type { get; set; } = 0;
    public int Status { get; set; } = 0;
    public string BankName { get; set; } = string.Empty;
    public string? Branch { get; set; }
    public string ChequeNumber { get; set; } = string.Empty;
    public string AccountName { get; set; } = string.Empty;
    public decimal Amount { get; set; } = 0m;
    public DateTime MaturityDate { get; set; } = DateTime.UtcNow;
    public DateTime? ClearedAt { get; set; }
    public DateTime? BouncedAt { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public string? BounceReason { get; set; }
    public string? CustomerReceivableId { get; set; }
    public string? ClearedReceivablePaymentId { get; set; }
    public string? ReceivablePaymentId { get; set; }
    public string? ProcessedByUserId { get; set; }

    public ICollection<BouncedChequeHistory> BouncedHistories { get; set; } = new List<BouncedChequeHistory>();
}

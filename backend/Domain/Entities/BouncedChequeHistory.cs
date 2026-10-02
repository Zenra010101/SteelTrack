namespace SteelTrack.Domain.Entities;

public class BouncedChequeHistory
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string SaleChequeId { get; set; } = string.Empty;
    public SaleCheque SaleCheque { get; set; } = null!;
    public string ChequeNumber { get; set; } = string.Empty;
    public string BankName { get; set; } = string.Empty;
    public string? Branch { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string? CustomerId { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public decimal Amount { get; set; } = 0m;
    public DateTime MaturityDate { get; set; } = DateTime.UtcNow;
    public DateTime BouncedDate { get; set; } = DateTime.UtcNow;
    public string Reason { get; set; } = string.Empty;
    public decimal PenaltyAmount { get; set; } = 0m;
    public string ProcessedByUserId { get; set; } = string.Empty;
    public string? CustomerReceivableId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

namespace SteelTrack.Domain.Entities;

public class Customer
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public int CustomerType { get; set; } = 0;
    public decimal CreditLimit { get; set; } = 0m;
    public bool IsBlacklisted { get; set; } = false;
    public string? CreatedByUserId { get; set; }
    public string? CustomerCode { get; set; }
    public bool EnableCredit { get; set; } = false;
    public int PaymentTerms { get; set; } = 0;
    public int DueDays { get; set; } = 0;
    public string? CustomPaymentTerms { get; set; }
    public bool AllowCheque { get; set; } = false;
    public bool IsBlocked { get; set; } = false;

    public ICollection<Sale> Sales { get; set; } = new List<Sale>();
    public ICollection<CustomerReceivable> Receivables { get; set; } = new List<CustomerReceivable>();
}

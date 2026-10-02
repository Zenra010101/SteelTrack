using SteelTrack.Domain.Enums;

namespace SteelTrack.Domain.Entities;

public class CustomerReceivable
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string SaleId { get; set; } = string.Empty;
    public Sale Sale { get; set; } = null!;
    public string? CustomerId { get; set; }
    public Customer? Customer { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public decimal TotalAmount { get; set; } = 0m;
    public decimal PaidAmount { get; set; } = 0m;
    public decimal RemainingBalance { get; set; } = 0m;
    public DateTime DueDate { get; set; } = DateTime.UtcNow;
    public ReceivableStatus Status { get; set; } = ReceivableStatus.Pending;
    public string? Notes { get; set; }
    public bool IsArchived { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public ICollection<ReceivablePayment> Payments { get; set; } = new List<ReceivablePayment>();
}

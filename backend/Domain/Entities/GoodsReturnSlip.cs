using SteelTrack.Domain.Enums;

namespace SteelTrack.Domain.Entities;

public class GoodsReturnSlip
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string GrsNumber { get; set; } = string.Empty;
    public string OriginalSaleId { get; set; } = string.Empty;
    public Sale OriginalSale { get; set; } = null!;
    public string ProcessedByUserId { get; set; } = string.Empty;
    public User ProcessedByUser { get; set; } = null!;
    public DateTime ReturnDate { get; set; } = DateTime.UtcNow;
    public decimal TotalReturnAmount { get; set; } = 0m;
    public string Reason { get; set; } = string.Empty;
    public bool GoodConditionConfirmed { get; set; } = false;
    public string? Notes { get; set; }
    public bool IsArchived { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public string? OriginalInvoiceNumber { get; set; }
    public string? CustomerName { get; set; }
    public DateTime OriginalSaleDate { get; set; } = DateTime.UtcNow;
    public int RefundMethod { get; set; } = 0;
    public ReturnStatus Status { get; set; } = ReturnStatus.Submitted;
    public DateTime? VoidedAt { get; set; }
    public string? VoidedByUserId { get; set; }
    public User? VoidedByUser { get; set; }
    public string? VoidReason { get; set; }
    public int WorkflowKind { get; set; } = 0;
    public DateTime? SubmittedAt { get; set; }
    public string? SubmittedByUserId { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? ApprovedByUserId { get; set; }
    public string? ApprovalNotes { get; set; }
    public DateTime? RejectedAt { get; set; }
    public string? RejectedByUserId { get; set; }
    public string? RejectionReason { get; set; }
    public DateTime? StockRestoredAt { get; set; }
    public string? GoodsExchangeId { get; set; }

    public ICollection<GoodsReturnSlipItem> Items { get; set; } = new List<GoodsReturnSlipItem>();
    public SalesReturnDeduction? Deduction { get; set; }
    public GoodsExchange? Exchange { get; set; }
}

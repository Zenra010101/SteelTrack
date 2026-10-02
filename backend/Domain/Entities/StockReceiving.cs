using SteelTrack.Domain.Enums;

namespace SteelTrack.Domain.Entities;

public class StockReceiving
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string ReceivingNumber { get; set; } = string.Empty;
    public string SupplierId { get; set; } = string.Empty;
    public Supplier Supplier { get; set; } = null!;
    public string ContainerNumber { get; set; } = string.Empty;
    public string StockNumber { get; set; } = string.Empty;
    public string ReferenceNumber { get; set; } = string.Empty;
    public DateTime DeliveryDate { get; set; } = DateTime.UtcNow;
    public StockReceivingStatus Status { get; set; } = StockReceivingStatus.Draft;
    public bool IsArchived { get; set; } = false;
    public string? Notes { get; set; }
    public string RequestedByUserId { get; set; } = string.Empty;
    public User RequestedByUser { get; set; } = null!;
    public string? ReviewedByUserId { get; set; }
    public User? ReviewedByUser { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? RejectionReason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public string? DeliveryReceiptNumber { get; set; }
    public string? ApprovalNotes { get; set; }
    public string? PurchaseOrderId { get; set; }

    public ICollection<StockReceivingItem> Items { get; set; } = new List<StockReceivingItem>();
    public ICollection<StockReceivingAttachment> Attachments { get; set; } = new List<StockReceivingAttachment>();
    public ICollection<ProductBatch> Batches { get; set; } = new List<ProductBatch>();
}

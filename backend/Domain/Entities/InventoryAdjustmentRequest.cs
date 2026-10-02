using SteelTrack.Domain.Enums;

namespace SteelTrack.Domain.Entities;

public class InventoryAdjustmentRequest
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string ProductId { get; set; } = string.Empty;
    public Product Product { get; set; } = null!;
    public int SystemQuantity { get; set; } = 0;
    public int ActualQuantity { get; set; } = 0;
    public int Difference { get; set; } = 0;
    public string Reason { get; set; } = string.Empty;
    public int Status { get; set; } = 0;
    public string RequestedByUserId { get; set; } = string.Empty;
    public User RequestedByUser { get; set; } = null!;
    public string? ReviewedByUserId { get; set; }
    public User? ReviewedByUser { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? RejectionReason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public AdjustmentType AdjustmentType { get; set; } = AdjustmentType.Other;
    public string? Notes { get; set; }
    public string? ApprovalNotes { get; set; }
    public string? CountingSessionId { get; set; }

    public ICollection<InventoryAdjustmentRequestLine> Lines { get; set; } = new List<InventoryAdjustmentRequestLine>();
}

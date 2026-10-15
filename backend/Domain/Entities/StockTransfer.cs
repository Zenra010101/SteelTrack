using System;

namespace SteelTrack.Domain.Entities;

public class StockTransfer
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string TransferNumber { get; set; } = string.Empty;
    public string BatchId { get; set; } = string.Empty;
    public string HeatNumber { get; set; } = string.Empty;
    public string SourceBranch { get; set; } = string.Empty;
    public string DestinationBranch { get; set; } = string.Empty;
    public decimal WeightInTons { get; set; }
    public string RequestedBy { get; set; } = string.Empty;
    public string? ApprovedBy { get; set; }
    public string Status { get; set; } = "Pending_Approval"; // Pending_Approval | In_Transit | Completed | Rejected
    public string? Reason { get; set; }
    public string? TrackingNumber { get; set; }
    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ShippedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime? RejectedAt { get; set; }
    public string? RejectionReason { get; set; }
}

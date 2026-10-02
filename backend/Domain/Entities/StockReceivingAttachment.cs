namespace SteelTrack.Domain.Entities;

public class StockReceivingAttachment
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public string StockReceivingId { get; set; } = string.Empty;
    public StockReceiving StockReceiving { get; set; } = null!;
    public string FileName { get; set; } = string.Empty;
    public string StoredFileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public string? Description { get; set; }
    public string UploadedByUserId { get; set; } = string.Empty;
}

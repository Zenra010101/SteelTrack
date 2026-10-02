namespace SteelTrack.Domain.Entities;

public class Supplier
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public string? ContactPerson { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public int PaymentTerms { get; set; } = 0;
    public string? CustomPaymentTerms { get; set; }
    public string? Notes { get; set; }
    public int Status { get; set; } = 0;
    public string? CreatedByUserId { get; set; }
    public string? SupplierCode { get; set; }
    public string? DeliveryNotes { get; set; }
    public string? SupplierRemarks { get; set; }

    public ICollection<Product> Products { get; set; } = new List<Product>();
    public ICollection<SupplierContact> Contacts { get; set; } = new List<SupplierContact>();
    public ICollection<SupplierAttachment> Attachments { get; set; } = new List<SupplierAttachment>();
    public ICollection<StockReceiving> StockReceivings { get; set; } = new List<StockReceiving>();
}

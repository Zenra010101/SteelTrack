namespace SteelTrack.Domain.Entities;

public class SupplierContact
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public string SupplierId { get; set; } = string.Empty;
    public Supplier Supplier { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public int Role { get; set; } = 0;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public bool IsPrimary { get; set; } = false;
}

using SteelTrack.Domain.Common;
using SteelTrack.Domain.Enums;

namespace SteelTrack.Domain.Entities;

public class SupplierContact : BaseEntity
{
    public Guid SupplierId { get; set; }
    public Supplier Supplier { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public SupplierContactRole Role { get; set; } = SupplierContactRole.General;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public bool IsPrimary { get; set; }
}

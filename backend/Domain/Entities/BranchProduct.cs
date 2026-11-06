using SteelTrack.Domain.Common;

namespace SteelTrack.Domain.Entities;

public class BranchProduct : BaseEntity
{
    public Guid BranchId { get; set; }
    public Branch Branch { get; set; } = null!;

    public Guid ProductId { get; set; }
    public Product Product { get; set; } = null!;

    public decimal SellingPrice { get; set; }
    public decimal DefaultCostPrice { get; set; }
    public int ReorderLevel { get; set; } = 10;
    public bool IsAvailable { get; set; } = true;
    public bool IsActive { get; set; } = true;

    public decimal? HalfPrice { get; set; }
    public decimal? QuarterPrice { get; set; }
    public decimal? ThreeQuarterPrice { get; set; }
}


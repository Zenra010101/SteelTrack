namespace SteelTrack.Domain.Entities;

public class User
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public string RoleId { get; set; } = string.Empty;
    public Role Role { get; set; } = null!;
    public string? BranchId { get; set; }
    public Branch? Branch { get; set; }
    public bool IsMainOwner { get; set; } = false;
    public bool CanViewAllBranches { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public ICollection<UserBranchAccess> BranchAccesses { get; set; } = new List<UserBranchAccess>();

    public ICollection<Sale> ProcessedSales { get; set; } = new List<Sale>();
    public ICollection<GoodsReturnSlip> ProcessedReturnSlips { get; set; } = new List<GoodsReturnSlip>();
    public ICollection<StockReceiving> RequestedStockReceivings { get; set; } = new List<StockReceiving>();
    public ICollection<StockReceiving> ReviewedStockReceivings { get; set; } = new List<StockReceiving>();
}

using System;

namespace SteelTrack.Domain.Entities;

public class UserBranchAccess
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string UserId { get; set; } = string.Empty;
    public User User { get; set; } = null!;
    public string BranchId { get; set; } = string.Empty;
    public Branch Branch { get; set; } = null!;
    public bool CanView { get; set; } = true;
    public bool CanOperate { get; set; } = true;
    public string? CreatedById { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

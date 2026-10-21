using System;
using SteelTrack.Domain.Common;
using SteelTrack.Domain.Entities;

namespace SteelTrack.Domain.Entities;

public class UserBranchAccess : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public Guid BranchId { get; set; }
    public Branch Branch { get; set; } = null!;
    public bool CanView { get; set; } = true;
    public bool CanOperate { get; set; } = true;
    public Guid? CreatedById { get; set; }
}

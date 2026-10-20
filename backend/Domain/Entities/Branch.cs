using System;
using System.Collections.Generic;

namespace SteelTrack.Domain.Entities;

public class Branch
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? TimeZoneId { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsDefault { get; set; } = false;

    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    public string? ContactNumber { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    public string? ManagerName { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public ICollection<User> Users { get; set; } = new List<User>();
    public ICollection<UserBranchAccess> UserAccesses { get; set; } = new List<UserBranchAccess>();
}

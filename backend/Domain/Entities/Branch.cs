using System;
using System.Collections.Generic;

namespace SteelTrack.Domain.Entities;

public class Branch
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? ContactNumber { get; set; }
    public string? ManagerName { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public ICollection<Role> Roles { get; set; } = new List<Role>();
}

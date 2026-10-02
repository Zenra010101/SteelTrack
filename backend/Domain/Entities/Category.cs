namespace SteelTrack.Domain.Entities;

public class Category
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public string? Icon { get; set; }
    public string? ColorAccent { get; set; }
    public string? ParentCategoryId { get; set; }
    public Category? ParentCategory { get; set; }
    public string? CreatedByUserId { get; set; }

    public ICollection<Category> SubCategories { get; set; } = new List<Category>();
    public ICollection<Product> Products { get; set; } = new List<Product>();
}

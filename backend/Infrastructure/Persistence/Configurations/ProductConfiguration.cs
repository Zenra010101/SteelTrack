using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SteelTrack.Domain.Entities;

namespace SteelTrack.Infrastructure.Persistence.Configurations;

public class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.ToTable("Products");

        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).HasMaxLength(36);

        builder.Property(p => p.Sku).IsRequired().HasMaxLength(100);
        builder.HasIndex(p => p.Sku).IsUnique();

        builder.Property(p => p.Name).IsRequired().HasMaxLength(255);
        builder.Property(p => p.Barcode).HasMaxLength(100);
        builder.HasIndex(p => p.Barcode);

        builder.Property(p => p.UnitPrice).HasColumnType("numeric(18,2)").IsRequired();
        builder.Property(p => p.CostPrice).HasColumnType("numeric(18,2)").IsRequired();

        builder.HasOne(p => p.Category)
               .WithMany(c => c.Products)
               .HasForeignKey(p => p.CategoryId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(p => p.Supplier)
               .WithMany(s => s.Products)
               .HasForeignKey(p => p.SupplierId)
               .OnDelete(DeleteBehavior.SetNull);
    }
}

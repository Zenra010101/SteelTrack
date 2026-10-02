using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SteelTrack.Domain.Entities;

namespace SteelTrack.Infrastructure.Persistence.Configurations;

public class StockReceivingConfiguration : IEntityTypeConfiguration<StockReceiving>
{
    public void Configure(EntityTypeBuilder<StockReceiving> builder)
    {
        builder.ToTable("StockReceivings");

        builder.HasKey(sr => sr.Id);
        builder.Property(sr => sr.Id).HasMaxLength(36);

        builder.Property(sr => sr.ReceivingNumber).IsRequired().HasMaxLength(100);
        builder.HasIndex(sr => sr.ReceivingNumber).IsUnique();

        builder.HasOne(sr => sr.Supplier)
               .WithMany(s => s.StockReceivings)
               .HasForeignKey(sr => sr.SupplierId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(sr => sr.RequestedByUser)
               .WithMany(u => u.RequestedStockReceivings)
               .HasForeignKey(sr => sr.RequestedByUserId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(sr => sr.ReviewedByUser)
               .WithMany(u => u.ReviewedStockReceivings)
               .HasForeignKey(sr => sr.ReviewedByUserId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}

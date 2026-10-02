using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SteelTrack.Domain.Entities;

namespace SteelTrack.Infrastructure.Persistence.Configurations;

public class InventoryAdjustmentRequestConfiguration : IEntityTypeConfiguration<InventoryAdjustmentRequest>
{
    public void Configure(EntityTypeBuilder<InventoryAdjustmentRequest> builder)
    {
        builder.ToTable("InventoryAdjustmentRequests");

        builder.HasKey(iar => iar.Id);
        builder.Property(iar => iar.Id).HasMaxLength(36);

        builder.Property(iar => iar.Reason).IsRequired().HasMaxLength(500);

        builder.HasOne(iar => iar.Product)
               .WithMany(p => p.InventoryAdjustmentRequests)
               .HasForeignKey(iar => iar.ProductId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(iar => iar.RequestedByUser)
               .WithMany()
               .HasForeignKey(iar => iar.RequestedByUserId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(iar => iar.ReviewedByUser)
               .WithMany()
               .HasForeignKey(iar => iar.ReviewedByUserId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}

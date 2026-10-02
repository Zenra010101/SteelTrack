using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SteelTrack.Domain.Entities;

namespace SteelTrack.Infrastructure.Persistence.Configurations;

public class ProductBatchConfiguration : IEntityTypeConfiguration<ProductBatch>
{
    public void Configure(EntityTypeBuilder<ProductBatch> builder)
    {
        builder.ToTable("ProductBatches");

        builder.HasKey(pb => pb.Id);
        builder.Property(pb => pb.Id).HasMaxLength(36);

        builder.Property(pb => pb.CostPrice).HasColumnType("numeric(18,2)").IsRequired();
        builder.Property(pb => pb.SellingPrice).HasColumnType("numeric(18,2)").IsRequired();

        builder.HasOne(pb => pb.Product)
               .WithMany(p => p.Batches)
               .HasForeignKey(pb => pb.ProductId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(pb => pb.StockReceiving)
               .WithMany(sr => sr.Batches)
               .HasForeignKey(pb => pb.StockReceivingId)
               .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(pb => pb.Supplier)
               .WithMany()
               .HasForeignKey(pb => pb.SupplierId)
               .OnDelete(DeleteBehavior.SetNull);
    }
}

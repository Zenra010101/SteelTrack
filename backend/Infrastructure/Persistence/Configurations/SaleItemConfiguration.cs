using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SteelTrack.Domain.Entities;

namespace SteelTrack.Infrastructure.Persistence.Configurations;

public class SaleItemConfiguration : IEntityTypeConfiguration<SaleItem>
{
    public void Configure(EntityTypeBuilder<SaleItem> builder)
    {
        builder.ToTable("SaleItems");

        builder.HasKey(si => si.Id);
        builder.Property(si => si.Id).HasMaxLength(36);

        builder.Property(si => si.UnitPrice).HasColumnType("numeric(18,2)").IsRequired();
        builder.Property(si => si.SellingPriceAtSale).HasColumnType("numeric(18,2)").IsRequired();
        builder.Property(si => si.CostPriceAtSale).HasColumnType("numeric(18,2)").IsRequired();
        builder.Property(si => si.ProfitAmount).HasColumnType("numeric(18,2)").IsRequired();
        builder.Property(si => si.Discount).HasColumnType("numeric(18,2)").IsRequired();
        builder.Property(si => si.LineTotal).HasColumnType("numeric(18,2)").IsRequired();

        builder.HasOne(si => si.Sale)
               .WithMany(s => s.Items)
               .HasForeignKey(si => si.SaleId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(si => si.Product)
               .WithMany(p => p.SaleItems)
               .HasForeignKey(si => si.ProductId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(si => si.ProductBatch)
               .WithMany()
               .HasForeignKey(si => si.ProductBatchId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}

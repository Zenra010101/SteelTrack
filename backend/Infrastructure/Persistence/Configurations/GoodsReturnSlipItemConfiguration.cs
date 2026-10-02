using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SteelTrack.Domain.Entities;

namespace SteelTrack.Infrastructure.Persistence.Configurations;

public class GoodsReturnSlipItemConfiguration : IEntityTypeConfiguration<GoodsReturnSlipItem>
{
    public void Configure(EntityTypeBuilder<GoodsReturnSlipItem> builder)
    {
        builder.ToTable("GoodsReturnSlipItems");

        builder.HasKey(grsi => grsi.Id);
        builder.Property(grsi => grsi.Id).HasMaxLength(36);

        builder.Property(grsi => grsi.UnitPrice).HasColumnType("numeric(18,2)").IsRequired();
        builder.Property(grsi => grsi.LineTotal).HasColumnType("numeric(18,2)").IsRequired();
        builder.Property(grsi => grsi.SellingPriceAtSale).HasColumnType("numeric(18,2)").IsRequired();
        builder.Property(grsi => grsi.CostPriceAtSale).HasColumnType("numeric(18,2)").IsRequired();

        builder.HasOne(grsi => grsi.GoodsReturnSlip)
               .WithMany(grs => grs.Items)
               .HasForeignKey(grsi => grsi.GoodsReturnSlipId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(grsi => grsi.SaleItem)
               .WithMany(si => si.GoodsReturnSlipItems)
               .HasForeignKey(grsi => grsi.SaleItemId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(grsi => grsi.Product)
               .WithMany()
               .HasForeignKey(grsi => grsi.ProductId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}

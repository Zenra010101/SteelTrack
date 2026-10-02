using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SteelTrack.Domain.Entities;

namespace SteelTrack.Infrastructure.Persistence.Configurations;

public class StockReceivingItemConfiguration : IEntityTypeConfiguration<StockReceivingItem>
{
    public void Configure(EntityTypeBuilder<StockReceivingItem> builder)
    {
        builder.ToTable("StockReceivingItems");

        builder.HasKey(sri => sri.Id);
        builder.Property(sri => sri.Id).HasMaxLength(36);

        builder.Property(sri => sri.CostPrice).HasColumnType("numeric(18,2)").IsRequired();
        builder.Property(sri => sri.SellingPrice).HasColumnType("numeric(18,2)").IsRequired();

        builder.HasOne(sri => sri.StockReceiving)
               .WithMany(sr => sr.Items)
               .HasForeignKey(sri => sri.StockReceivingId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(sri => sri.Product)
               .WithMany(p => p.StockReceivingItems)
               .HasForeignKey(sri => sri.ProductId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}

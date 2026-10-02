using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SteelTrack.Domain.Entities;

namespace SteelTrack.Infrastructure.Persistence.Configurations;

public class GoodsReturnSlipConfiguration : IEntityTypeConfiguration<GoodsReturnSlip>
{
    public void Configure(EntityTypeBuilder<GoodsReturnSlip> builder)
    {
        builder.ToTable("GoodsReturnSlips");

        builder.HasKey(g => g.Id);
        builder.Property(g => g.Id).HasMaxLength(36);

        builder.Property(g => g.GrsNumber).IsRequired().HasMaxLength(100);
        builder.HasIndex(g => g.GrsNumber).IsUnique();

        builder.Property(g => g.TotalReturnAmount).HasColumnType("numeric(18,2)").IsRequired();
        builder.Property(g => g.Reason).IsRequired().HasMaxLength(500);

        builder.HasOne(g => g.OriginalSale)
               .WithMany(s => s.ReturnSlips)
               .HasForeignKey(g => g.OriginalSaleId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(g => g.ProcessedByUser)
               .WithMany(u => u.ProcessedReturnSlips)
               .HasForeignKey(g => g.ProcessedByUserId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(g => g.VoidedByUser)
               .WithMany()
               .HasForeignKey(g => g.VoidedByUserId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}

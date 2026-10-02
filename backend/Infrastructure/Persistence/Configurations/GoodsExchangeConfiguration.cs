using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SteelTrack.Domain.Entities;

namespace SteelTrack.Infrastructure.Persistence.Configurations;

public class GoodsExchangeConfiguration : IEntityTypeConfiguration<GoodsExchange>
{
    public void Configure(EntityTypeBuilder<GoodsExchange> builder)
    {
        builder.ToTable("GoodsExchanges");

        builder.HasKey(ge => ge.Id);
        builder.Property(ge => ge.Id).HasMaxLength(36);

        builder.Property(ge => ge.ExchangeNumber).IsRequired().HasMaxLength(100);
        builder.HasIndex(ge => ge.ExchangeNumber).IsUnique();

        builder.Property(ge => ge.ReturnCreditTotal).HasColumnType("numeric(18,2)").IsRequired();
        builder.Property(ge => ge.ReplacementTotal).HasColumnType("numeric(18,2)").IsRequired();
        builder.Property(ge => ge.AmountPaid).HasColumnType("numeric(18,2)").IsRequired();

        builder.HasOne(ge => ge.GoodsReturnSlip)
               .WithOne(grs => grs.Exchange)
               .HasForeignKey<GoodsExchange>(ge => ge.GoodsReturnSlipId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(ge => ge.TopUpSale)
               .WithMany()
               .HasForeignKey(ge => ge.TopUpSaleId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(ge => ge.CompletedByUser)
               .WithMany()
               .HasForeignKey(ge => ge.CompletedByUserId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}

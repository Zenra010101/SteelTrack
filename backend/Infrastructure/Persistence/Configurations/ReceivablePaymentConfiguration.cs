using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SteelTrack.Domain.Entities;

namespace SteelTrack.Infrastructure.Persistence.Configurations;

public class ReceivablePaymentConfiguration : IEntityTypeConfiguration<ReceivablePayment>
{
    public void Configure(EntityTypeBuilder<ReceivablePayment> builder)
    {
        builder.ToTable("ReceivablePayments");

        builder.HasKey(rp => rp.Id);
        builder.Property(rp => rp.Id).HasMaxLength(36);

        builder.Property(rp => rp.Amount).HasColumnType("numeric(18,2)").IsRequired();
        builder.Property(rp => rp.BalanceBefore).HasColumnType("numeric(18,2)").IsRequired();
        builder.Property(rp => rp.BalanceAfter).HasColumnType("numeric(18,2)").IsRequired();

        builder.HasOne(rp => rp.CustomerReceivable)
               .WithMany(cr => cr.Payments)
               .HasForeignKey(rp => rp.CustomerReceivableId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(rp => rp.GoodsReturnSlip)
               .WithMany()
               .HasForeignKey(rp => rp.GoodsReturnSlipId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(rp => rp.RecordedByUser)
               .WithMany()
               .HasForeignKey(rp => rp.RecordedByUserId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}

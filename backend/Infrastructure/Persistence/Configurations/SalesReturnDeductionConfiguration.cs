using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SteelTrack.Domain.Entities;

namespace SteelTrack.Infrastructure.Persistence.Configurations;

public class SalesReturnDeductionConfiguration : IEntityTypeConfiguration<SalesReturnDeduction>
{
    public void Configure(EntityTypeBuilder<SalesReturnDeduction> builder)
    {
        builder.ToTable("SalesReturnDeductions");

        builder.HasKey(srd => srd.Id);
        builder.Property(srd => srd.Id).HasMaxLength(36);

        builder.Property(srd => srd.Amount).HasColumnType("numeric(18,2)").IsRequired();

        builder.HasOne(srd => srd.GoodsReturnSlip)
               .WithOne(grs => grs.Deduction)
               .HasForeignKey<SalesReturnDeduction>(srd => srd.GoodsReturnSlipId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(srd => srd.ProcessedByUser)
               .WithMany()
               .HasForeignKey(srd => srd.ProcessedByUserId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}

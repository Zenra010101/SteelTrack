using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SteelTrack.Domain.Entities;

namespace SteelTrack.Infrastructure.Persistence.Configurations;

public class CustomerReceivableConfiguration : IEntityTypeConfiguration<CustomerReceivable>
{
    public void Configure(EntityTypeBuilder<CustomerReceivable> builder)
    {
        builder.ToTable("CustomerReceivables");

        builder.HasKey(cr => cr.Id);
        builder.Property(cr => cr.Id).HasMaxLength(36);

        builder.Property(cr => cr.TotalAmount).HasColumnType("numeric(18,2)").IsRequired();
        builder.Property(cr => cr.PaidAmount).HasColumnType("numeric(18,2)").IsRequired();
        builder.Property(cr => cr.RemainingBalance).HasColumnType("numeric(18,2)").IsRequired();

        builder.HasOne(cr => cr.Sale)
               .WithOne(s => s.CustomerReceivable)
               .HasForeignKey<CustomerReceivable>(cr => cr.SaleId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(cr => cr.Customer)
               .WithMany(c => c.Receivables)
               .HasForeignKey(cr => cr.CustomerId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}

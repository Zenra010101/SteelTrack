using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SteelTrack.Domain.Entities;

namespace SteelTrack.Infrastructure.Persistence.Configurations;

public class SaleConfiguration : IEntityTypeConfiguration<Sale>
{
    public void Configure(EntityTypeBuilder<Sale> builder)
    {
        builder.ToTable("Sales");

        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).HasMaxLength(36);

        builder.Property(s => s.SaleNumber).IsRequired().HasMaxLength(100);
        builder.HasIndex(s => s.SaleNumber).IsUnique();

        builder.Property(s => s.SubTotal).HasColumnType("numeric(18,2)").IsRequired();
        builder.Property(s => s.DiscountPercent).HasColumnType("numeric(18,2)").IsRequired();
        builder.Property(s => s.DiscountAmount).HasColumnType("numeric(18,2)").IsRequired();
        builder.Property(s => s.TaxRate).HasColumnType("numeric(18,2)").IsRequired();
        builder.Property(s => s.TaxAmount).HasColumnType("numeric(18,2)").IsRequired();
        builder.Property(s => s.WithholdingAmount).HasColumnType("numeric(18,2)").IsRequired();
        builder.Property(s => s.ManualTaxValue).HasColumnType("numeric(18,2)").IsRequired();
        builder.Property(s => s.TotalAmount).HasColumnType("numeric(18,2)").IsRequired();
        builder.Property(s => s.GrossProfit).HasColumnType("numeric(18,2)").IsRequired();
        builder.Property(s => s.AmountPaid).HasColumnType("numeric(18,2)").IsRequired();
        builder.Property(s => s.ChangeAmount).HasColumnType("numeric(18,2)").IsRequired();

        builder.HasOne(s => s.User)
               .WithMany(u => u.ProcessedSales)
               .HasForeignKey(s => s.UserId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(s => s.Customer)
               .WithMany(c => c.Sales)
               .HasForeignKey(s => s.CustomerId)
               .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(s => s.ReplacesSale)
               .WithMany()
               .HasForeignKey(s => s.ReplacesSaleId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(s => s.ReplacedBySale)
               .WithMany()
               .HasForeignKey(s => s.ReplacedBySaleId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SteelTrack.Domain.Entities;

namespace SteelTrack.Infrastructure.Persistence.Configurations;

public class InventoryTransactionConfiguration : IEntityTypeConfiguration<InventoryTransaction>
{
    public void Configure(EntityTypeBuilder<InventoryTransaction> builder)
    {
        builder.ToTable("InventoryTransactions");

        builder.HasKey(it => it.Id);
        builder.Property(it => it.Id).HasMaxLength(36);

        builder.HasOne(it => it.Product)
               .WithMany(p => p.InventoryTransactions)
               .HasForeignKey(it => it.ProductId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(it => it.StockReceiving)
               .WithMany()
               .HasForeignKey(it => it.StockReceivingId)
               .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(it => it.User)
               .WithMany()
               .HasForeignKey(it => it.UserId)
               .OnDelete(DeleteBehavior.SetNull);
    }
}

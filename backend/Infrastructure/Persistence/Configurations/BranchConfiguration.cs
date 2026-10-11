using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SteelTrack.Domain.Entities;

namespace SteelTrack.Infrastructure.Persistence.Configurations;

public class BranchConfiguration : IEntityTypeConfiguration<Branch>
{
    public void Configure(EntityTypeBuilder<Branch> builder)
    {
        builder.ToTable("Branches");

        builder.HasKey(b => b.Id);
        builder.Property(b => b.Id).HasMaxLength(36);

        builder.Property(b => b.Code).IsRequired().HasMaxLength(20);
        builder.HasIndex(b => b.Code).IsUnique();

        builder.Property(b => b.Name).IsRequired().HasMaxLength(100);
        builder.Property(b => b.Address).HasMaxLength(255);
        builder.Property(b => b.ContactNumber).HasMaxLength(50);
        builder.Property(b => b.ManagerName).HasMaxLength(100);
        builder.Property(b => b.IsActive).IsRequired().HasDefaultValue(true);

        builder.HasMany(b => b.Roles)
            .WithOne(r => r.Branch)
            .HasForeignKey(r => r.BranchId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SteelTrack.Domain.Entities;

namespace SteelTrack.Infrastructure.Persistence.Configurations;

public class RoleConfiguration : IEntityTypeConfiguration<Role>
{
    public void Configure(EntityTypeBuilder<Role> builder)
    {
        builder.ToTable("Roles");

        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).HasMaxLength(36);

        builder.Property(r => r.Name).IsRequired().HasMaxLength(100);
        builder.HasIndex(r => r.Name).IsUnique();

        builder.Property(r => r.Description).IsRequired().HasMaxLength(500);

        builder.Property(r => r.BranchId).HasMaxLength(36);
        builder.HasOne(r => r.Branch)
            .WithMany(b => b.Roles)
            .HasForeignKey(r => r.BranchId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

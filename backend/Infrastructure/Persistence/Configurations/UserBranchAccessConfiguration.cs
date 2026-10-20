using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SteelTrack.Domain.Entities;

namespace SteelTrack.Infrastructure.Persistence.Configurations;

public class UserBranchAccessConfiguration : IEntityTypeConfiguration<UserBranchAccess>
{
    public void Configure(EntityTypeBuilder<UserBranchAccess> builder)
    {
        builder.ToTable("UserBranchAccess");

        builder.HasKey(uba => uba.Id);
        builder.Property(uba => uba.Id).HasMaxLength(36);

        builder.Property(uba => uba.UserId).IsRequired().HasMaxLength(36);
        builder.Property(uba => uba.BranchId).IsRequired().HasMaxLength(36);
        builder.Property(uba => uba.CreatedById).HasMaxLength(36);

        builder.Property(uba => uba.CanView).IsRequired();
        builder.Property(uba => uba.CanOperate).IsRequired();

        builder.HasOne(uba => uba.User)
               .WithMany(u => u.BranchAccesses)
               .HasForeignKey(uba => uba.UserId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(uba => uba.Branch)
               .WithMany(b => b.UserAccesses)
               .HasForeignKey(uba => uba.BranchId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}

using Microsoft.EntityFrameworkCore;
using SteelTrack.Domain.Entities;

namespace SteelTrack.Infrastructure.Persistence;

public class SteelTrackDbContext : DbContext
{
    public SteelTrackDbContext(DbContextOptions<SteelTrackDbContext> options) : base(options)
    {
    }

    public DbSet<SteelBatch> SteelBatches => Set<SteelBatch>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<SteelBatch>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.HeatNumber).IsRequired().HasMaxLength(50);
            entity.Property(e => e.Grade).HasConversion<string>();
            entity.Property(e => e.Status).HasConversion<string>();
            entity.Property(e => e.Dimensions).HasMaxLength(100);
            entity.Property(e => e.Location).HasMaxLength(100);
        });
    }
}

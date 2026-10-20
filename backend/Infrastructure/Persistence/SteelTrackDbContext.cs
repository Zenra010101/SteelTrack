using GensanPOS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace SteelTrack.Infrastructure.Persistence;

public class SteelTrackDbContext : AppDbContext
{
    public SteelTrackDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }
}

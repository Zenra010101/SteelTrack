using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace SteelTrack.Infrastructure.Persistence;

/// <summary>Design-time factory for <c>dotnet ef migrations</c> (PostgreSQL).</summary>
public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(
                Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
                ?? "Server=db78267.public.databaseasp.net;Port=5432;Database=db78267;User Id=db78267;Password=y!8CN5p#dS_4;Ssl Mode=Prefer;Trust Server Certificate=true;")
            .Options;

        return new AppDbContext(options);
    }
}

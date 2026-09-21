using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SteelTrack.Application.Interfaces;
using SteelTrack.Infrastructure.Persistence;
using SteelTrack.Infrastructure.Repositories;

namespace SteelTrack.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration? configuration = null)
    {
        // Register PostgreSQL DbContext if connection string is provided
        var connectionString = configuration?.GetConnectionString("PostgreSQLConnection");
        if (!string.IsNullOrWhiteSpace(connectionString))
        {
            services.AddDbContext<SteelTrackDbContext>(options =>
                options.UseNpgsql(connectionString));
        }

        // Singleton In-Memory Repository for quick local dev, easily swap to EF Core repository
        services.AddSingleton<ISteelRepository, InMemorySteelRepository>();

        return services;
    }
}

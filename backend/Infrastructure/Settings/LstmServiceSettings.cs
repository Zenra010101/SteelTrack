using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace SteelTrack.Infrastructure.Settings;

public class LstmServiceSettings
{
    public const string SectionName = "Lstm";

    public string BaseUrl { get; set; } = "http://localhost:8000";
    public string ApiKey { get; set; } = "dev-api-key-change-me";
    public int LookbackMonths { get; set; } = 24;
    public int HorizonMonths { get; set; } = 3;
}

public static class LstmServiceSettingsExtensions
{
    public static IServiceCollection ConfigureLstmService(this IServiceCollection services, IConfiguration configuration)
        => services.Configure<LstmServiceSettings>(configuration.GetSection(LstmServiceSettings.SectionName));
}

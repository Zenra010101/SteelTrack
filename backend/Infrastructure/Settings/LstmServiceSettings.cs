using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace SteelTrack.Infrastructure.Settings;

public class LstmServiceSettings
{
    public const string SectionName = "Lstm";

    public string BaseUrl { get; set; } = "http://localhost:8000";
    public string ApiKey { get; set; } = "st_live_lstm_dAnBjPTeD6YZCoQdm5UX5RpZVDBqRSRLrctKzG8z-bQ";
    public int LookbackMonths { get; set; } = 24;
    public int HorizonMonths { get; set; } = 3;
    public string ModelVersion { get; set; } = "v0.2.0-csv-20261102T133101Z";
}

public static class LstmServiceSettingsExtensions
{
    public static IServiceCollection ConfigureLstmService(this IServiceCollection services, IConfiguration configuration)
        => services.Configure<LstmServiceSettings>(configuration.GetSection(LstmServiceSettings.SectionName));
}

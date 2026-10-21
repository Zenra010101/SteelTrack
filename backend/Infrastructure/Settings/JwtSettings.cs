namespace SteelTrack.Infrastructure.Settings;

public class JwtSettings
{
    public const string SectionName = "Jwt";
    public string Secret { get; set; } = string.Empty;
    public string Issuer { get; set; } = "SteelTrack";
    public string Audience { get; set; } = "SteelTrack";
    public int ExpirationHours { get; set; } = 8;
}

namespace SteelTrack.Infrastructure.Settings;

public class JwtSettings
{
    public const string SectionName = "Jwt";
    public string Secret { get; set; } = string.Empty;
    public string Issuer { get; set; } = "SteelTrack";
    public string Audience { get; set; } = "SteelTrack";
    public int ExpirationHours { get; set; } = 8;

    /// <summary>
    /// When true (the default), every process start gets a fresh instance id,
    /// so restarting the backend invalidates the session tokens it issued
    /// before the restart. Set this to false in a deployment where sessions
    /// are expected to survive a restart.
    /// </summary>
    public bool RotateOnStartup { get; set; } = true;

    /// <summary>
    /// Pins the instance id to a fixed value, so sessions survive restarts.
    /// Use this for multi-instance hosting where a load balancer may route
    /// requests to any one of several processes.
    /// </summary>
    public string? InstanceId { get; set; }
}

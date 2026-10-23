using System;
using Microsoft.Extensions.Configuration;

namespace SteelTrack.Infrastructure.Services;

/// <summary>
/// One source of truth for everything that decides which JWTs this process
/// accepts: the process instance id, plus the secret / issuer / audience /
/// expiry used to mint tokens.
///
/// The instance id is what makes backend-restart invalidation work. Every token
/// minted before a restart carries an <see cref="InstanceClaimType"/> claim that
/// the restarted process no longer recognises, so a restart produces real 401s
/// rather than a token that silently keeps working.
///
/// The browser-reload case must not touch any of this: reloading the page does
/// not restart the process, the instance id is unchanged, and the stored token
/// stays byte-for-byte identical.
/// </summary>
public sealed class ServerInstance
{
    /// <summary>Custom claim type carried on every issued JWT.</summary>
    public const string InstanceClaimType = "stt_instance";

    /// <summary>Identity of this process.</summary>
    public string InstanceId { get; }

    /// <summary>When the process started.</summary>
    public DateTime StartedAtUtc { get; }

    /// <summary>Secret that tokens are signed with and validated against.</summary>
    public string Secret { get; }

    /// <summary>Issuer declared on issued tokens.</summary>
    public string Issuer { get; }

    /// <summary>Audience declared on issued tokens.</summary>
    public string Audience { get; }

    /// <summary>How long a session lasts, in hours.</summary>
    public int ExpirationHours { get; }

    /// <summary>
    /// True when each process gets a fresh instance id at startup, so a
    /// restart invalidates every token issued before it.
    /// </summary>
    public bool RotateOnStartup { get; }

    /// <summary>
    /// True when the instance id is pinned by configuration and therefore
    /// survives restarts. Set <c>Jwt:InstanceId</c> for multi-instance hosting
    /// where a load balancer may route to any instance.
    /// </summary>
    public bool IsPinned => !string.IsNullOrWhiteSpace(PinnedInstanceId);

    /// <summary>The configured pin, if any.</summary>
    public string? PinnedInstanceId { get; }

    private ServerInstance(
        string instanceId,
        string secret,
        string issuer,
        string audience,
        int expirationHours,
        bool rotateOnStartup,
        string? pinnedInstanceId)
    {
        InstanceId = instanceId;
        Secret = secret;
        Issuer = issuer;
        Audience = audience;
        ExpirationHours = expirationHours;
        RotateOnStartup = rotateOnStartup;
        PinnedInstanceId = pinnedInstanceId;
        StartedAtUtc = DateTime.UtcNow;
    }

    /// <summary>
    /// Build the instance from configuration.
    ///
    /// Instance id resolution, in priority order:
    ///   1. <c>Jwt:InstanceId</c> set — that exact value, pinned across restarts.
    ///   2. <c>Jwt:RotateOnStartup</c> false — a constant, also pinned.
    ///   3. otherwise — a fresh GUID per process, so a restart ends every session.
    /// </summary>
    /// <exception cref="InvalidOperationException">
    /// The <c>Jwt</c> section or its <c>Secret</c> is missing. Failing here is
    /// deliberate: a missing secret used to mean the API validated tokens
    /// against one value while <c>JwtTokenService</c> signed them with another,
    /// and every login silently produced a token the API rejected.
    /// </exception>
    public static ServerInstance Create(IConfiguration configuration)
    {
        var jwt = configuration.GetSection("Jwt");

        var secret = jwt["Secret"];
        if (string.IsNullOrWhiteSpace(secret))
        {
            throw new InvalidOperationException(
                "Configuration section 'Jwt' is missing a 'Secret'. Set it in appsettings.json " +
                "or via the Jwt__Secret environment variable before starting the API.");
        }

        var issuer = jwt["Issuer"];
        if (string.IsNullOrWhiteSpace(issuer))
            issuer = "SteelTrack";

        var audience = jwt["Audience"];
        if (string.IsNullOrWhiteSpace(audience))
            audience = "SteelTrack";

        var expirationHours = jwt.GetValue("ExpirationHours", 12);

        // Rotation is on by default: a restarted backend should not keep
        // accepting tokens minted by the process that is gone.
        var rotateOnStartup = jwt.GetValue("RotateOnStartup", true);

        var pinned = jwt["InstanceId"]?.Trim();
        if (!string.IsNullOrWhiteSpace(pinned))
        {
            return new ServerInstance(
                pinned, secret, issuer, audience, expirationHours,
                rotateOnStartup, pinned);
        }

        if (!rotateOnStartup)
        {
            const string staticId = "static";
            return new ServerInstance(
                staticId, secret, issuer, audience, expirationHours,
                false, null);
        }

        return new ServerInstance(
            Guid.NewGuid().ToString("N"), secret, issuer, audience, expirationHours,
            true, null);
    }
}

namespace SteelTrack.Api.Common;

/// <summary>
/// Why a session ended. These travel to the browser in the 401/403 body so
/// the frontend can say what actually happened instead of a generic
/// "please sign in again".
/// </summary>
public static class SessionEndReasons
{
    /// <summary>
    /// The token was minted by a backend process that is no longer running —
    /// the API was restarted.
    /// </summary>
    public const string ServerRestarted = "server_restarted";

    /// <summary>The token's own expiry has passed.</summary>
    public const string TokenExpired = "token_expired";

    /// <summary>The token is malformed or was signed with a key we do not accept.</summary>
    public const string InvalidToken = "invalid_token";

    /// <summary>No token was supplied at all.</summary>
    public const string MissingToken = "missing_token";

    /// <summary>The user is authenticated but not allowed to do this.</summary>
    public const string Forbidden = "forbidden";
}

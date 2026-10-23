using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SteelTrack.Infrastructure.Services;

namespace SteelTrack.Api.Controllers;

/// <summary>
/// Exposes the identity of the running backend process, so the browser can
/// tell whether the server it is talking to is the same one that issued the
/// session token it holds.
///
/// The route lives under <c>/api</c> on purpose: the Vite dev server proxies
/// only that prefix to the .NET API, so a route outside it would be
/// unreachable from the SPA during development.
/// </summary>
[ApiController]
[Route("api/session")]
public class SessionController : ControllerBase
{
    private readonly ServerInstance _instance;

    public SessionController(ServerInstance instance) => _instance = instance;

    /// <summary>
    /// The current process's instance id and start time.
    ///
    /// Anonymous by design: the browser needs to be able to ask "is the server
    /// I am talking to the one that issued my token?" without first proving
    /// that the token is still good — that is the whole point of the check.
    /// </summary>
    [HttpGet("instance")]
    [AllowAnonymous]
    public ActionResult<object> GetInstance() => Ok(new
    {
        instanceId = _instance.InstanceId,
        startedAtUtc = _instance.StartedAtUtc,
        rotatesOnStartup = _instance.RotateOnStartup
    });
}

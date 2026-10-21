using SteelTrack.Application.Common;
using SteelTrack.Application.DTOs;
using SteelTrack.Infrastructure.Settings;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace SteelTrack.Api.Controllers;

[ApiController]
[Route("api/app-features")]
[Authorize]
public class AppFeaturesController : ControllerBase
{
    private readonly ExchangeWorkflowOptions _options;

    public AppFeaturesController(IOptions<ExchangeWorkflowOptions> options) => _options = options.Value;

    [HttpGet]
    public ActionResult<ApiResponse<AppFeaturesDto>> Get() =>
        Ok(ApiResponse<AppFeaturesDto>.Ok(new AppFeaturesDto
        {
            ExchangeWorkflowPhase1Enabled = false
        }));
}

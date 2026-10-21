using SteelTrack.Application.Common;
using SteelTrack.Application.DTOs.Settings;
using SteelTrack.Application.Interfaces;
using SteelTrack.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SteelTrack.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SettingsController : ControllerBase
{
    private readonly IStoreSettingsService _settingsService;

    public SettingsController(IStoreSettingsService settingsService) => _settingsService = settingsService;

    [HttpGet]
    public async Task<ActionResult<ApiResponse<StoreSettingsDto>>> Get(CancellationToken cancellationToken)
    {
        var settings = await _settingsService.GetAsync(cancellationToken);
        return Ok(ApiResponse<StoreSettingsDto>.Ok(settings));
    }

    [HttpPut]
    [Authorize(Roles = RoleNames.Owner)]
    public async Task<ActionResult<ApiResponse<StoreSettingsDto>>> Update(
        [FromBody] UpdateStoreSettingsRequest request,
        CancellationToken cancellationToken)
    {
        var settings = await _settingsService.UpdateAsync(request, cancellationToken);
        return Ok(ApiResponse<StoreSettingsDto>.Ok(settings, "Settings saved"));
    }
}

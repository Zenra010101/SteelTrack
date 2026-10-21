using System.Security.Claims;
using SteelTrack.Application.Common;
using SteelTrack.Application.DTOs.Dashboard;
using SteelTrack.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SteelTrack.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly IDashboardService _dashboardService;

    public DashboardController(IDashboardService dashboardService) => _dashboardService = dashboardService;

    [HttpGet]
    public async Task<ActionResult<ApiResponse<DashboardDto>>> GetSummary(CancellationToken cancellationToken)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var role = User.FindFirstValue(ClaimTypes.Role)!;
        var summary = await _dashboardService.GetSummaryAsync(userId, role, cancellationToken);
        return Ok(ApiResponse<DashboardDto>.Ok(summary));
    }
}

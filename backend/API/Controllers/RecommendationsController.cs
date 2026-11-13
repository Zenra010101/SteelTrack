using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SteelTrack.Application.Common;
using SteelTrack.Application.DTOs.Rbdss;
using SteelTrack.Application.Interfaces;

namespace SteelTrack.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RecommendationsController : ControllerBase
{
    private readonly IRbdssService _rbdssService;

    public RecommendationsController(IRbdssService rbdssService)
    {
        _rbdssService = rbdssService;
    }

    /// <summary>
    /// Executes the Rule-Based Decision Support System (RBDSS) and returns
    /// lateral transshipment, procurement, and inventory posture recommendations.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ApiResponse<RbdssResponseDto>>> GetRecommendations(
        [FromBody] RbdssRequestDto? request,
        CancellationToken cancellationToken)
    {
        var result = await _rbdssService.GetRecommendationsAsync(
            request ?? new RbdssRequestDto(), cancellationToken);

        return Ok(ApiResponse<RbdssResponseDto>.Ok(result));
    }
}


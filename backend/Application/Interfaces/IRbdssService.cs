using SteelTrack.Application.DTOs.Rbdss;

namespace SteelTrack.Application.Interfaces;

/// <summary>
/// Executes the Rule-Based Decision Support System (RBDSS) for lateral
/// transshipment and procurement recommendations, integrating the 5 core rules.
/// </summary>
public interface IRbdssService
{
    Task<RbdssResponseDto> GetRecommendationsAsync(
        RbdssRequestDto request,
        CancellationToken cancellationToken = default);
}


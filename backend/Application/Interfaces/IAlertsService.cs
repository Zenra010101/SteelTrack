using SteelTrack.Application.DTOs.Alerts;

namespace SteelTrack.Application.Interfaces;

public interface IAlertsService
{
    Task<AlertsSummaryDto> GetSummaryAsync(
        Guid userId,
        string role,
        CancellationToken cancellationToken = default);
}

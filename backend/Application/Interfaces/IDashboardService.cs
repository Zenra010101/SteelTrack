using SteelTrack.Application.DTOs.Dashboard;

namespace SteelTrack.Application.Interfaces;

public interface IDashboardService
{
    Task<DashboardDto> GetSummaryAsync(Guid userId, string role, CancellationToken cancellationToken = default);
}

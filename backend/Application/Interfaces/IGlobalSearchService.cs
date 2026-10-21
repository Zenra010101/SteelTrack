using SteelTrack.Application.DTOs.Search;

namespace SteelTrack.Application.Interfaces;

public interface IGlobalSearchService
{
    Task<GlobalSearchResultDto> SearchAsync(string query, CancellationToken cancellationToken = default);
}

using SteelTrack.Application.DTOs.Archive;

namespace SteelTrack.Application.Interfaces;

public interface IArchiveService
{
    Task<ArchiveResultDto> PreviewArchiveBeforeAsync(ArchiveRequest request, CancellationToken cancellationToken = default);

    Task<ArchiveResultDto> ArchiveBeforeAsync(
        ArchiveRequest request,
        Guid userId,
        string? userEmail,
        CancellationToken cancellationToken = default);
}

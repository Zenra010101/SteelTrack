using SteelTrack.Application.DTOs.Audit;
using SteelTrack.Domain.Enums;

namespace SteelTrack.Application.Interfaces;

public interface IAuditLogService
{
    Task<IReadOnlyList<AuditLogDto>> GetRecentAsync(int count = 50, CancellationToken cancellationToken = default);

    Task<AuditLogSearchResult> SearchAsync(
        DateTime? from,
        DateTime? to,
        AuditLogCategory? category,
        string? action,
        string? entityType,
        string? search,
        int page = 1,
        int pageSize = 50,
        bool includeArchived = false,
        CancellationToken cancellationToken = default);

    Task<byte[]> ExportExcelAsync(
        DateTime? from,
        DateTime? to,
        AuditLogCategory? category,
        string? action,
        string? entityType,
        string? search,
        CancellationToken cancellationToken = default);

    Task<byte[]> ExportPdfAsync(
        DateTime? from,
        DateTime? to,
        AuditLogCategory? category,
        string? action,
        string? entityType,
        string? search,
        CancellationToken cancellationToken = default);
}

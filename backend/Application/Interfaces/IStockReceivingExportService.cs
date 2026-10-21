using SteelTrack.Application.DTOs.StockReceiving;

namespace SteelTrack.Application.Interfaces;

public interface IStockReceivingExportService
{
    Task<byte[]> ExportExcelAsync(StockReceivingSearchQuery query, Guid userId, string role, bool includeFinancials, CancellationToken cancellationToken = default);
    Task<byte[]> ExportPdfAsync(StockReceivingSearchQuery query, Guid userId, string role, bool includeFinancials, CancellationToken cancellationToken = default);
    Task<byte[]> ExportReceivingReportPdfAsync(Guid id, Guid userId, string role, bool includeFinancials, CancellationToken cancellationToken = default);
}

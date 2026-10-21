using SteelTrack.Application.DTOs.Inventory;

namespace SteelTrack.Application.Interfaces;

public interface IInventoryAdjustmentExportService
{
    Task<byte[]> ExportExcelAsync(
        InventoryAdjustmentSearchQuery query,
        Guid userId,
        string role,
        bool includeFinancials,
        CancellationToken cancellationToken = default);

    Task<byte[]> ExportPdfAsync(
        InventoryAdjustmentSearchQuery query,
        Guid userId,
        string role,
        bool includeFinancials,
        CancellationToken cancellationToken = default);
}

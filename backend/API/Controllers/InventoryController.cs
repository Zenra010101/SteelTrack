using System.Security.Claims;
using SteelTrack.Application.Common;
using SteelTrack.Application.DTOs.Inventory;
using SteelTrack.Application.Interfaces;
using SteelTrack.Domain.Constants;
using SteelTrack.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace SteelTrack.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class InventoryController : ControllerBase
{
    private readonly IInventoryService _inventoryService;
    private readonly IInventoryExportService _exportService;
    private readonly AppDbContext _context;

    public InventoryController(
        IInventoryService inventoryService,
        IInventoryExportService exportService,
        AppDbContext context)
    {
        _inventoryService = inventoryService;
        _exportService = exportService;
        _context = context;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private bool IsOwner => User.IsInRole(RoleNames.Owner);

    [HttpGet("summary")]
    public async Task<ActionResult<ApiResponse<InventorySummaryDto>>> GetSummary(CancellationToken cancellationToken)
    {
        var summary = await _inventoryService.GetSummaryAsync(IsOwner, cancellationToken);
        return Ok(ApiResponse<InventorySummaryDto>.Ok(summary));
    }

    [HttpGet("on-hand")]
    public async Task<ActionResult> GetOnHand(
        [FromQuery] string? search,
        [FromQuery] Guid? categoryId,
        [FromQuery] Guid? productId,
        [FromQuery] bool? lowStockOnly,
        [FromQuery] int page,
        [FromQuery] int pageSize,
        CancellationToken cancellationToken = default)
    {
        if (page > 0)
        {
            var paged = await _inventoryService.GetOnHandPagedAsync(
                search, categoryId, productId, lowStockOnly, IsOwner, page, pageSize, cancellationToken);
            return Ok(ApiResponse<PagedResult<InventoryOnHandDto>>.Ok(paged));
        }

        var rows = await _inventoryService.GetOnHandAsync(
            search, categoryId, productId, lowStockOnly, IsOwner, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<InventoryOnHandDto>>.Ok(rows));
    }

    [HttpGet]
    public async Task<ActionResult> GetTransactions(
        [FromQuery] InventorySearchQuery query,
        CancellationToken cancellationToken)
    {
        if (query.Page > 0)
        {
            var paged = await _inventoryService.GetTransactionsPagedAsync(query, cancellationToken);
            return Ok(ApiResponse<PagedResult<InventoryTransactionDto>>.Ok(paged));
        }

        var transactions = await _inventoryService.GetTransactionsAsync(query.ProductId, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<InventoryTransactionDto>>.Ok(transactions));
    }

    [HttpGet("export/on-hand")]
    public async Task<IActionResult> ExportOnHand(
        [FromQuery] string format = "excel",
        [FromQuery] string? search = null,
        [FromQuery] Guid? categoryId = null,
        [FromQuery] bool? lowStockOnly = null,
        CancellationToken cancellationToken = default)
    {
        var isPdf = string.Equals(format, "pdf", StringComparison.OrdinalIgnoreCase);
        var bytes = isPdf
            ? await _exportService.ExportOnHandPdfAsync(search, categoryId, lowStockOnly, IsOwner, cancellationToken)
            : await _exportService.ExportOnHandExcelAsync(search, categoryId, lowStockOnly, IsOwner, cancellationToken);
        var ext = isPdf ? "pdf" : "xlsx";
        var contentType = isPdf ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        return File(bytes, contentType, $"inventory-on-hand-{DateTime.UtcNow:yyyyMMdd}.{ext}");
    }

    [HttpGet("export/movements")]
    public async Task<IActionResult> ExportMovements(
        [FromQuery] InventorySearchQuery query,
        [FromQuery] string format = "excel",
        CancellationToken cancellationToken = default)
    {
        var isPdf = string.Equals(format, "pdf", StringComparison.OrdinalIgnoreCase);
        var bytes = isPdf
            ? await _exportService.ExportMovementsPdfAsync(query, cancellationToken)
            : await _exportService.ExportMovementsExcelAsync(query, cancellationToken);
        var ext = isPdf ? "pdf" : "xlsx";
        var contentType = isPdf ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        return File(bytes, contentType, $"inventory-movements-{DateTime.UtcNow:yyyyMMdd}.{ext}");
    }

    [HttpGet("stock-list")]
    [Authorize(Roles = $"{RoleNames.Owner},{RoleNames.BranchManager},{RoleNames.SuperAdmin},BranchManager,Cashier")]
    public async Task<ActionResult<ApiResponse<InventoryStockListReportDto>>> GetStockList(
        [FromQuery] string? search = null,
        [FromQuery] Guid? categoryId = null,
        [FromQuery] bool? lowStockOnly = null,
        CancellationToken cancellationToken = default)
    {
        var report = await _inventoryService.GetStockListReportAsync(
            search, categoryId, lowStockOnly, cancellationToken);
        return Ok(ApiResponse<InventoryStockListReportDto>.Ok(report));
    }

    [HttpGet("export/stock-list")]
    [Authorize(Roles = $"{RoleNames.Owner},{RoleNames.BranchManager},{RoleNames.SuperAdmin},BranchManager,Cashier")]
    public async Task<IActionResult> ExportStockList(
        [FromQuery] string format = "pdf",
        [FromQuery] string? search = null,
        [FromQuery] Guid? categoryId = null,
        [FromQuery] bool? lowStockOnly = null,
        CancellationToken cancellationToken = default)
    {
        var isPdf = string.Equals(format, "pdf", StringComparison.OrdinalIgnoreCase);
        var bytes = isPdf
            ? await _exportService.ExportStockListPdfAsync(search, categoryId, lowStockOnly, cancellationToken)
            : await _exportService.ExportStockListExcelAsync(search, categoryId, lowStockOnly, cancellationToken);
        var ext = isPdf ? "pdf" : "xlsx";
        var contentType = isPdf ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        return File(bytes, contentType, $"inventory-stock-list-{DateTime.UtcNow:yyyyMMdd}.{ext}");
    }

    [HttpPost("adjust")]
    [Authorize(Roles = $"{RoleNames.Owner},{RoleNames.BranchManager},{RoleNames.SuperAdmin},BranchManager,Cashier")]
    public async Task<ActionResult<ApiResponse<InventoryTransactionDto>>> Adjust(
        [FromBody] AdjustInventoryRequest request,
        CancellationToken cancellationToken)
    {
        var transaction = await _inventoryService.AdjustAsync(request, UserId, cancellationToken);
        return Ok(ApiResponse<InventoryTransactionDto>.Ok(transaction, "Inventory adjusted"));
    }

    public class UpdateBatchStatusRequest
    {
        public string? Status { get; set; }
        public string? NewLocation { get; set; }
    }

    [HttpPut("{id:guid}/status")]
    [Authorize(Roles = $"{RoleNames.Owner},{RoleNames.BranchManager},{RoleNames.SuperAdmin},BranchManager,Cashier")]
    public async Task<IActionResult> UpdateStatus(
        Guid id,
        [FromBody] UpdateBatchStatusRequest request,
        CancellationToken cancellationToken)
    {
        var targetStatus = request?.Status?.Trim() ?? "Available";

        // 1. Try finding BranchProduct
        var bp = await _context.BranchProducts
            .Include(x => x.Product)
            .FirstOrDefaultAsync(x => x.Id == id || x.ProductId == id, cancellationToken);

        if (bp != null)
        {
            switch (targetStatus.ToLowerInvariant())
            {
                case "available":
                    bp.IsAvailable = true;
                    bp.IsActive = true;
                    break;
                case "reserved":
                    bp.IsAvailable = false;
                    bp.IsActive = true;
                    break;
                case "qualitycheck":
                case "quality_check":
                    bp.IsAvailable = false;
                    bp.IsActive = true;
                    break;
                case "inproduction":
                case "in_production":
                    bp.IsAvailable = false;
                    bp.IsActive = true;
                    break;
                case "shipped":
                    bp.IsAvailable = false;
                    bp.IsActive = false;
                    break;
                default:
                    bp.IsAvailable = true;
                    break;
            }

            bp.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);

            return Ok(new
            {
                success = true,
                id = bp.Id.ToString(),
                status = targetStatus,
                isAvailable = bp.IsAvailable,
                isActive = bp.IsActive
            });
        }

        // 2. Try finding SteelBatch
        var sb = await _context.SteelBatches.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (sb != null)
        {
            if (Enum.TryParse<Domain.Enums.BatchStatus>(targetStatus, true, out var parsedStatus))
            {
                sb.Status = parsedStatus;
            }
            if (!string.IsNullOrWhiteSpace(request?.NewLocation))
            {
                sb.Location = request.NewLocation;
            }
            sb.LastUpdated = DateTime.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);

            return Ok(new
            {
                success = true,
                id = sb.Id.ToString(),
                status = sb.Status.ToString()
            });
        }

        return NotFound(new { message = $"Inventory item or batch '{id}' not found." });
    }
}

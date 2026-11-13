using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using SteelTrack.Domain.Entities;
using SteelTrack.Domain.Enums;
using SteelTrack.Infrastructure.Persistence;
using SteelTrack.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

using Microsoft.AspNetCore.SignalR;
using SteelTrack.Api.Hubs;

namespace SteelTrack.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class StockTransfersController : ControllerBase
{
    private readonly AppDbContext? _dbContext;
    private readonly ILogger<StockTransfersController> _logger;
    private readonly IHubContext<SteelTrackHub>? _hubContext;

    public StockTransfersController(
        AppDbContext? dbContext,
        ILogger<StockTransfersController> logger,
        IHubContext<SteelTrackHub>? hubContext = null)
    {
        _dbContext = dbContext;
        _logger = logger;
        _hubContext = hubContext;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll([FromQuery] string? branch, [FromQuery] string? status)
    {
        if (_dbContext == null) return Ok(GetFallbackMockTransfers());

        var query = _dbContext.StockTransfers.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(branch) && !string.Equals(branch, "All", StringComparison.OrdinalIgnoreCase))
        {
            var b = branch.Trim().ToLower();
            query = query.Where(t =>
                t.SourceBranch.ToLower() == b ||
                t.DestinationBranch.ToLower() == b ||
                t.SourceBranch.ToLower().Contains(b) ||
                t.DestinationBranch.ToLower().Contains(b));
        }

        if (!string.IsNullOrWhiteSpace(status) && !string.Equals(status, "All", StringComparison.OrdinalIgnoreCase))
        {
            var s = status.Trim().ToLower();
            query = query.Where(t => t.Status.ToLower() == s ||
                                     (s == "pending" && t.Status == "Pending_Approval") ||
                                     (s == "intransit" && (t.Status == "In_Transit" || t.Status == "InTransit")));
        }

        var list = await query
            .OrderByDescending(t => t.RequestedAt)
            .ToListAsync();

        return Ok(list);
    }

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateStockTransferRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.HeatNumber))
        {
            return BadRequest(new { message = "Heat Number or SKU is required for steel transfers." });
        }

        var transferNum = $"TRX-{DateTime.UtcNow.Year}-{Random.Shared.Next(1000, 9999)}";
        var entity = new StockTransfer
        {
            Id = Guid.NewGuid().ToString(),
            TransferNumber = transferNum,
            BatchId = request.BatchId ?? Guid.NewGuid().ToString(),
            HeatNumber = request.HeatNumber.Trim().ToUpper(),
            SourceBranch = request.SourceBranch,
            DestinationBranch = request.DestinationBranch,
            WeightInTons = request.WeightInTons,
            RequestedBy = request.RequestedBy,
            Reason = request.Reason,
            TrackingNumber = $"TRK-{Random.Shared.Next(100000, 999999)}",
            Status = "Pending_Approval",
            RequestedAt = DateTime.UtcNow
        };

        if (_dbContext != null)
        {
            _dbContext.StockTransfers.Add(entity);
            await _dbContext.SaveChangesAsync();
        }

        if (_hubContext != null)
        {
            try
            {
                await _hubContext.Clients.All.SendAsync("TransferRequested", new
                {
                    transferNumber = entity.TransferNumber,
                    sourceBranch = entity.SourceBranch,
                    destinationBranch = entity.DestinationBranch,
                    weightInTons = entity.WeightInTons,
                    timestamp = DateTime.UtcNow
                });

                await _hubContext.Clients.Group($"branch_{entity.DestinationBranch.ToLowerInvariant()}").SendAsync("ApprovalRequired", new
                {
                    type = "StockTransfer",
                    title = $"New Transfer Request #{entity.TransferNumber}",
                    message = $"{entity.SourceBranch} requested to transfer {entity.WeightInTons}T to {entity.DestinationBranch}.",
                    transferId = entity.Id,
                    timestamp = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to broadcast transfer notification via SignalR");
            }
        }

        return CreatedAtAction(nameof(GetAll), new { id = entity.Id }, entity);
    }

    [HttpPost("{id}/approve")]
    [HttpPut("{id}/approve")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Approve(string id, [FromBody] ApproveTransferRequest request, CancellationToken cancellationToken = default)
    {
        if (_dbContext == null)
        {
            return Ok(new { message = "Transfer approved (Mock mode)", id, status = "Approved" });
        }

        var transfer = await _dbContext.StockTransfers.FirstOrDefaultAsync(t => t.Id == id || t.TransferNumber == id, cancellationToken);
        if (transfer == null)
        {
            return NotFound(new { message = $"Transfer '{id}' not found." });
        }

        if (string.Equals(transfer.Status, "Approved", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = $"Transfer '{transfer.TransferNumber}' is already approved." });
        }

        if (string.Equals(transfer.Status, "Completed", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(transfer.Status, "Rejected", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = $"Cannot approve transfer currently in '{transfer.Status}' status." });
        }

        // 1. Resolve sending and receiving branches
        var sourceBranch = await ResolveBranchAsync(transfer.SourceBranch, cancellationToken);
        if (sourceBranch == null)
        {
            return BadRequest(new { message = $"Sending branch '{transfer.SourceBranch}' could not be identified." });
        }

        var destinationBranch = await ResolveBranchAsync(transfer.DestinationBranch, cancellationToken);
        if (destinationBranch == null)
        {
            return BadRequest(new { message = $"Receiving branch '{transfer.DestinationBranch}' could not be identified." });
        }

        if (sourceBranch.Id == destinationBranch.Id)
        {
            return BadRequest(new { message = "Sending branch and receiving branch cannot be the same branch." });
        }

        // 2. Resolve transferred product
        var product = await ResolveProductAsync(transfer, cancellationToken);
        if (product == null)
        {
            return BadRequest(new { message = $"Transferred steel product '{transfer.HeatNumber}' (Batch/ID: {transfer.BatchId}) could not be found in catalog." });
        }

        // 3. Calculate quantity to transfer
        int quantityToTransfer = (int)Math.Round(transfer.WeightInTons, MidpointRounding.AwayFromZero);
        if (quantityToTransfer <= 0 && transfer.WeightInTons > 0)
        {
            quantityToTransfer = 1;
        }
        if (quantityToTransfer <= 0)
        {
            return BadRequest(new { message = "Transfer quantity must be greater than zero." });
        }

        // 4. Validate sending branch stock sufficiency
        var sendingBatches = await _dbContext.ProductBatches
            .Where(b => b.ProductId == product.Id && b.IsActive && b.Quantity > 0 &&
                       (b.BranchId == sourceBranch.Id || b.BranchId == null))
            .OrderBy(b => b.BranchId.HasValue ? 0 : 1)
            .ThenBy(b => b.ReceivedDate)
            .ThenBy(b => b.CreatedAt)
            .ToListAsync(cancellationToken);

        int totalSendingStock = sendingBatches.Sum(b => b.Quantity);
        if (totalSendingStock < quantityToTransfer)
        {
            return BadRequest(new
            {
                message = $"Insufficient inventory at sending branch '{sourceBranch.Name}'. Available stock: {totalSendingStock} units, Requested transfer: {quantityToTransfer} units for '{product.Sku} - {product.Name}'."
            });
        }

        // 5. Execute atomic transaction (status update + deduction + addition)
        await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            // A. Deduct transferred quantities from sending branch
            int remainingToDeduct = quantityToTransfer;
            ProductBatch? lastSourceBatch = null;

            foreach (var batch in sendingBatches)
            {
                if (remainingToDeduct <= 0) break;
                int deduct = Math.Min(batch.Quantity, remainingToDeduct);
                batch.Quantity -= deduct;
                batch.BranchId ??= sourceBranch.Id;
                batch.UpdatedAt = DateTime.UtcNow;
                remainingToDeduct -= deduct;
                lastSourceBatch = batch;
            }

            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            Guid? approverUserId = Guid.TryParse(userIdClaim, out var parsedUid) ? parsedUid : null;

            _dbContext.InventoryTransactions.Add(new InventoryTransaction
            {
                ProductId = product.Id,
                ProductBatchId = lastSourceBatch?.Id,
                Type = InventoryTransactionType.Adjustment,
                Quantity = -quantityToTransfer,
                StockBefore = totalSendingStock,
                StockAfter = totalSendingStock - quantityToTransfer,
                Reference = transfer.TransferNumber,
                Notes = $"Inter-branch transfer OUT to {destinationBranch.Name} (Transfer #{transfer.TransferNumber})",
                UserId = approverUserId
            });

            // B. Add transferred quantities to receiving branch
            var destBatches = await _dbContext.ProductBatches
                .Where(b => b.ProductId == product.Id && b.BranchId == destinationBranch.Id && b.IsActive)
                .ToListAsync(cancellationToken);
            int destStockBefore = destBatches.Sum(b => b.Quantity);

            var receivingBatch = new ProductBatch
            {
                Id = Guid.NewGuid(),
                ProductId = product.Id,
                BranchId = destinationBranch.Id,
                BatchCode = $"TRF-{transfer.TransferNumber}",
                CostPrice = lastSourceBatch?.CostPrice ?? product.CostPrice,
                SellingPrice = lastSourceBatch?.SellingPrice ?? product.UnitPrice,
                ReceivedQuantity = quantityToTransfer,
                Quantity = quantityToTransfer,
                ReceivedDate = DateOnly.FromDateTime(DateTime.UtcNow),
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            await _dbContext.ProductBatches.AddAsync(receivingBatch, cancellationToken);

            _dbContext.InventoryTransactions.Add(new InventoryTransaction
            {
                ProductId = product.Id,
                ProductBatchId = receivingBatch.Id,
                Type = InventoryTransactionType.Adjustment,
                Quantity = quantityToTransfer,
                StockBefore = destStockBefore,
                StockAfter = destStockBefore + quantityToTransfer,
                Reference = transfer.TransferNumber,
                Notes = $"Inter-branch transfer IN from {sourceBranch.Name} (Transfer #{transfer.TransferNumber})",
                UserId = approverUserId
            });

            // Ensure destination branch has active BranchProduct catalog entry
            var destBranchProduct = await _dbContext.BranchProducts
                .FirstOrDefaultAsync(bp => bp.BranchId == destinationBranch.Id && bp.ProductId == product.Id, cancellationToken);
            if (destBranchProduct == null)
            {
                await _dbContext.BranchProducts.AddAsync(new BranchProduct
                {
                    BranchId = destinationBranch.Id,
                    ProductId = product.Id,
                    SellingPrice = product.UnitPrice,
                    DefaultCostPrice = product.CostPrice,
                    ReorderLevel = product.ReorderLevel,
                    IsAvailable = true,
                    IsActive = true
                }, cancellationToken);
            }
            else
            {
                destBranchProduct.IsAvailable = true;
                destBranchProduct.IsActive = true;
            }

            // Sync total product stock
            await ProductBatchStockHelper.SyncProductStockAsync(_dbContext, product, cancellationToken);

            // C. Update transfer entity
            transfer.Status = "Approved";
            transfer.ApprovedBy = string.IsNullOrWhiteSpace(request.ApproverName) ? "Branch Operations Manager" : request.ApproverName;

            // D. Save & commit
            await _dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            _logger.LogInformation(
                "Stock transfer {TransferNumber} successfully approved. Deducted {DeductedQty} units from {Source} and credited {CreditedQty} units to {Dest}.",
                transfer.TransferNumber, quantityToTransfer, sourceBranch.Name, quantityToTransfer, destinationBranch.Name);

            return Ok(transfer);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            _logger.LogError(ex, "Failed to approve stock transfer {TransferId}", id);
            return StatusCode(StatusCodes.Status500InternalServerError, new { message = $"Failed to approve transfer: {ex.Message}" });
        }
    }

    [HttpPost("{id}/dispatch")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Dispatch(string id)
    {
        if (_dbContext == null)
        {
            return Ok(new { message = "Transfer dispatched (Mock mode)", id, status = "In_Transit" });
        }

        var transfer = await _dbContext.StockTransfers.FirstOrDefaultAsync(t => t.Id == id || t.TransferNumber == id);
        if (transfer == null) return NotFound(new { message = $"Transfer '{id}' not found." });

        transfer.Status = "In_Transit";
        transfer.ShippedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();
        return Ok(transfer);
    }

    [HttpPost("{id}/receive")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Receive(string id)
    {
        if (_dbContext == null)
        {
            return Ok(new { message = "Transfer received (Mock mode)", id, status = "Completed" });
        }

        var transfer = await _dbContext.StockTransfers.FirstOrDefaultAsync(t => t.Id == id || t.TransferNumber == id);
        if (transfer == null) return NotFound(new { message = $"Transfer '{id}' not found." });

        transfer.Status = "Completed";
        transfer.CompletedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();
        return Ok(transfer);
    }

    [HttpPost("{id}/reject")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Reject(string id, [FromBody] RejectTransferRequest request)
    {
        if (_dbContext == null)
        {
            return Ok(new { message = "Transfer rejected (Mock mode)", id, status = "Rejected" });
        }

        var transfer = await _dbContext.StockTransfers.FirstOrDefaultAsync(t => t.Id == id || t.TransferNumber == id);
        if (transfer == null) return NotFound(new { message = $"Transfer '{id}' not found." });

        transfer.Status = "Rejected";
        transfer.RejectedAt = DateTime.UtcNow;
        transfer.RejectionReason = request.RejectionReason;

        await _dbContext.SaveChangesAsync();
        return Ok(transfer);
    }

    private async Task<Branch?> ResolveBranchAsync(string? branchStr, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(branchStr) || _dbContext == null) return null;
        var clean = branchStr.Trim().ToLower();

        var branch = await _dbContext.Branches
            .FirstOrDefaultAsync(b => b.Name.ToLower() == clean || b.Code.ToLower() == clean, cancellationToken);
        if (branch != null) return branch;

        if (clean == "br1" || clean.Contains("davao"))
            return await _dbContext.Branches.FirstOrDefaultAsync(b => b.Code == "BR1" || b.Name.ToLower().Contains("davao"), cancellationToken);
        if (clean == "br2" || clean.Contains("cagayan"))
            return await _dbContext.Branches.FirstOrDefaultAsync(b => b.Code == "BR2" || b.Name.ToLower().Contains("cagayan"), cancellationToken);
        if (clean == "br3" || clean.Contains("cebu"))
            return await _dbContext.Branches.FirstOrDefaultAsync(b => b.Code == "BR3" || b.Name.ToLower().Contains("cebu"), cancellationToken);
        if (clean == "br4" || clean.Contains("mandaue"))
            return await _dbContext.Branches.FirstOrDefaultAsync(b => b.Code == "BR4" || b.Name.ToLower().Contains("mandaue"), cancellationToken);

        return await _dbContext.Branches.FirstOrDefaultAsync(b => b.Name.ToLower().Contains(clean) || clean.Contains(b.Name.ToLower()), cancellationToken);
    }

    private async Task<Product?> ResolveProductAsync(StockTransfer transfer, CancellationToken cancellationToken = default)
    {
        if (_dbContext == null) return null;

        // 1. Try BatchId as Guid
        if (Guid.TryParse(transfer.BatchId, out var parsedGuid))
        {
            var product = await _dbContext.Products.FirstOrDefaultAsync(p => p.Id == parsedGuid, cancellationToken);
            if (product != null) return product;

            var bp = await _dbContext.BranchProducts.Include(x => x.Product).FirstOrDefaultAsync(x => x.Id == parsedGuid, cancellationToken);
            if (bp?.Product != null) return bp.Product;

            var pb = await _dbContext.ProductBatches.Include(x => x.Product).FirstOrDefaultAsync(x => x.Id == parsedGuid, cancellationToken);
            if (pb?.Product != null) return pb.Product;
        }

        // 2. Try HeatNumber as SKU or Barcode
        if (!string.IsNullOrWhiteSpace(transfer.HeatNumber))
        {
            var cleanHeat = transfer.HeatNumber.Trim();
            var product = await _dbContext.Products
                .FirstOrDefaultAsync(p => p.Sku == cleanHeat || p.Barcode == cleanHeat, cancellationToken);
            if (product != null) return product;

            var pb = await _dbContext.ProductBatches.Include(x => x.Product)
                .FirstOrDefaultAsync(b => b.BatchCode == cleanHeat, cancellationToken);
            if (pb?.Product != null) return pb.Product;
        }

        // 3. Fallback partial match on Sku or Name
        if (!string.IsNullOrWhiteSpace(transfer.HeatNumber))
        {
            var term = transfer.HeatNumber.Trim().ToLower();
            var product = await _dbContext.Products
                .FirstOrDefaultAsync(p => p.Sku.ToLower().Contains(term) || p.Name.ToLower().Contains(term), cancellationToken);
            if (product != null) return product;
        }

        return null;
    }

    private static List<StockTransfer> GetFallbackMockTransfers() => new()
    {
        new StockTransfer
        {
            Id = "trx-001",
            TransferNumber = "TRX-2026-0812",
            BatchId = "batch-101",
            HeatNumber = "HT-2026-8841",
            SourceBranch = "Davao",
            DestinationBranch = "Cagayan",
            WeightInTons = 5.5m,
            RequestedBy = "Carlos Reyes (Branch Manager)",
            ApprovedBy = "Elena Rostova (Executive Owner)",
            Status = "In_Transit",
            TrackingNumber = "TRK-992140",
            Reason = "Fulfill urgent structural beam order for commercial wharf expansion (Grade: A36_Structural)",
            RequestedAt = DateTime.UtcNow.AddDays(-1),
            ShippedAt = DateTime.UtcNow.AddHours(-10)
        },
        new StockTransfer
        {
            Id = "trx-002",
            TransferNumber = "TRX-2026-0799",
            BatchId = "batch-102",
            HeatNumber = "HT-2026-1049",
            SourceBranch = "Mandaue",
            DestinationBranch = "Cebu",
            WeightInTons = 8.0m,
            RequestedBy = "Visayas Yard Supervisor",
            ApprovedBy = "Elena Rostova (Executive Owner)",
            Status = "Completed",
            TrackingNumber = "TRK-881290",
            Reason = "Plate inventory rebalancing across Mandaue-Cebu corridor (Grade: SS304_Stainless)",
            RequestedAt = DateTime.UtcNow.AddDays(-5),
            ShippedAt = DateTime.UtcNow.AddDays(-4),
            CompletedAt = DateTime.UtcNow.AddDays(-3)
        }
    };
}

public class CreateStockTransferRequest
{
    public string? BatchId { get; set; }
    public string HeatNumber { get; set; } = string.Empty;
    public string SourceBranch { get; set; } = "Davao";
    public string DestinationBranch { get; set; } = "Cagayan";
    public decimal WeightInTons { get; set; }
    public string RequestedBy { get; set; } = string.Empty;
    public string? Reason { get; set; }
}

public class ApproveTransferRequest
{
    public string ApproverName { get; set; } = string.Empty;
}

public class RejectTransferRequest
{
    public string RejectionReason { get; set; } = string.Empty;
}

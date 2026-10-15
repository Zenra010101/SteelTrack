using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SteelTrack.Domain.Entities;
using SteelTrack.Infrastructure.Persistence;

namespace SteelTrack.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StockTransfersController : ControllerBase
{
    private readonly SteelTrackDbContext? _dbContext;

    public StockTransfersController(SteelTrackDbContext? dbContext = null)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll([FromQuery] string? branch, [FromQuery] string? status)
    {
        if (_dbContext == null) return Ok(GetFallbackMockTransfers());

        var query = _dbContext.StockTransfers.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(branch))
        {
            var b = branch.Trim().ToLower();
            query = query.Where(t => t.SourceBranch.ToLower() == b || t.DestinationBranch.ToLower() == b);
        }

        if (!string.IsNullOrWhiteSpace(status) && status != "All")
        {
            query = query.Where(t => t.Status == status);
        }

        var list = await query
            .OrderByDescending(t => t.RequestedAt)
            .ToListAsync();

        if (list.Count == 0)
        {
            return Ok(GetFallbackMockTransfers());
        }

        return Ok(list);
    }

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateStockTransferRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.HeatNumber))
        {
            return BadRequest(new { message = "Heat Number is required for steel transfers." });
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

        return CreatedAtAction(nameof(GetAll), new { id = entity.Id }, entity);
    }

    [HttpPost("{id}/approve")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Approve(string id, [FromBody] ApproveTransferRequest request)
    {
        if (_dbContext == null)
        {
            return Ok(new { message = "Transfer approved (Mock mode)", id, status = "In_Transit" });
        }

        var transfer = await _dbContext.StockTransfers.FindAsync(id);
        if (transfer == null) return NotFound(new { message = $"Transfer '{id}' not found." });

        transfer.Status = "In_Transit";
        transfer.ApprovedBy = request.ApproverName;
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

        var transfer = await _dbContext.StockTransfers.FindAsync(id);
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

        var transfer = await _dbContext.StockTransfers.FindAsync(id);
        if (transfer == null) return NotFound(new { message = $"Transfer '{id}' not found." });

        transfer.Status = "Rejected";
        transfer.RejectedAt = DateTime.UtcNow;
        transfer.RejectionReason = request.RejectionReason;

        await _dbContext.SaveChangesAsync();
        return Ok(transfer);
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
            Reason = "Fulfill urgent structural beam order for commercial wharf expansion",
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
            Reason = "Plate inventory rebalancing across Mandaue-Cebu corridor",
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

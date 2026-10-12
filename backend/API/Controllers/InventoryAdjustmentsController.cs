using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SteelTrack.Domain.Entities;
using SteelTrack.Domain.Enums;
using SteelTrack.Infrastructure.Persistence;

namespace SteelTrack.Api.Controllers;

[ApiController]
[Route("api/inventory-adjustments")]
public class InventoryAdjustmentsController : ControllerBase
{
    private readonly SteelTrackDbContext? _dbContext;

    public InventoryAdjustmentsController(SteelTrackDbContext? dbContext = null)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] int? status,
        [FromQuery] string? productId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        if (_dbContext == null) return Ok(new { data = new List<object>(), totalCount = 0 });

        var query = _dbContext.InventoryAdjustmentRequests
            .AsNoTracking()
            .Include(a => a.Product)
            .Include(a => a.RequestedByUser)
            .Include(a => a.ReviewedByUser)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(a =>
                a.Reason.ToLower().Contains(s) ||
                (a.Product != null && a.Product.Name.ToLower().Contains(s)) ||
                (a.Product != null && a.Product.Sku.ToLower().Contains(s)));
        }

        if (status.HasValue)
        {
            query = query.Where(a => a.Status == status.Value);
        }

        if (!string.IsNullOrWhiteSpace(productId))
        {
            query = query.Where(a => a.ProductId == productId);
        }

        var totalCount = await query.CountAsync();
        var adjustments = await query
            .OrderByDescending(a => a.CreatedAt)
            .Skip((Math.Max(1, page) - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(new
        {
            data = adjustments,
            totalCount,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
        });
    }

    [HttpGet("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(string id)
    {
        if (_dbContext == null) return NotFound();

        var adjustment = await _dbContext.InventoryAdjustmentRequests
            .AsNoTracking()
            .Include(a => a.Product)
            .Include(a => a.RequestedByUser)
            .Include(a => a.ReviewedByUser)
            .Include(a => a.Lines)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (adjustment == null) return NotFound(new { message = $"Adjustment request with ID '{id}' not found." });

        return Ok(adjustment);
    }

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateAdjustmentRequestDto dto)
    {
        if (_dbContext == null) return StatusCode(503, "Database unavailable.");

        var product = await _dbContext.Products.FindAsync(dto.ProductId);
        if (product == null) return BadRequest(new { message = $"Product with ID '{dto.ProductId}' not found." });

        var systemQty = product.StockQuantity;
        var diff = dto.ActualQuantity - systemQty;

        var userId = dto.RequestedByUserId;
        if (string.IsNullOrWhiteSpace(userId))
        {
            var defaultUser = await _dbContext.Users.FirstOrDefaultAsync();
            userId = defaultUser?.Id ?? "usr-001";
        }

        var adjustment = new InventoryAdjustmentRequest
        {
            Id = Guid.NewGuid().ToString(),
            ProductId = dto.ProductId,
            SystemQuantity = systemQty,
            ActualQuantity = dto.ActualQuantity,
            Difference = diff,
            Reason = dto.Reason,
            Status = 0, // Pending
            RequestedByUserId = userId,
            AdjustmentType = dto.AdjustmentType,
            Notes = dto.Notes,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.InventoryAdjustmentRequests.Add(adjustment);
        await _dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = adjustment.Id }, adjustment);
    }

    [HttpPost("{id}/approve")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Approve(string id, [FromBody] ApproveAdjustmentDto? dto)
    {
        if (_dbContext == null) return StatusCode(503, "Database unavailable.");

        var adjustment = await _dbContext.InventoryAdjustmentRequests
            .Include(a => a.Product)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (adjustment == null) return NotFound(new { message = $"Adjustment request '{id}' not found." });

        if (adjustment.Status == 1)
            return BadRequest(new { message = "Adjustment request has already been approved." });

        adjustment.Status = 1; // Approved
        adjustment.ReviewedByUserId = dto?.ReviewedByUserId;
        adjustment.ReviewedAt = DateTime.UtcNow;
        adjustment.ApprovalNotes = dto?.ApprovalNotes;
        adjustment.UpdatedAt = DateTime.UtcNow;

        // Apply stock adjustment to Product
        var product = await _dbContext.Products.FindAsync(adjustment.ProductId);
        if (product != null)
        {
            product.StockQuantity = adjustment.ActualQuantity;
            product.UpdatedAt = DateTime.UtcNow;
        }

        await _dbContext.SaveChangesAsync();
        return Ok(new { message = $"Inventory adjustment approved. Product '{product?.Name}' stock updated to {adjustment.ActualQuantity}." });
    }

    [HttpPost("{id}/reject")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Reject(string id, [FromBody] RejectAdjustmentDto dto)
    {
        if (_dbContext == null) return StatusCode(503, "Database unavailable.");

        var adjustment = await _dbContext.InventoryAdjustmentRequests.FindAsync(id);
        if (adjustment == null) return NotFound(new { message = $"Adjustment request '{id}' not found." });

        adjustment.Status = 2; // Rejected
        adjustment.RejectionReason = dto.RejectionReason ?? "Rejected by authorized manager";
        adjustment.ReviewedByUserId = dto.ReviewedByUserId;
        adjustment.ReviewedAt = DateTime.UtcNow;
        adjustment.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();
        return Ok(new { message = "Inventory adjustment request rejected." });
    }
}

public class CreateAdjustmentRequestDto
{
    public string ProductId { get; set; } = string.Empty;
    public int ActualQuantity { get; set; }
    public string Reason { get; set; } = string.Empty;
    public AdjustmentType AdjustmentType { get; set; } = AdjustmentType.Other;
    public string? Notes { get; set; }
    public string? RequestedByUserId { get; set; }
}

public class ApproveAdjustmentDto
{
    public string? ReviewedByUserId { get; set; }
    public string? ApprovalNotes { get; set; }
}

public class RejectAdjustmentDto
{
    public string? ReviewedByUserId { get; set; }
    public string? RejectionReason { get; set; }
}

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
[Route("api/[controller]")]
public class StockReceivingController : ControllerBase
{
    private readonly SteelTrackDbContext? _dbContext;

    public StockReceivingController(SteelTrackDbContext? dbContext = null)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] StockReceivingStatus? status,
        [FromQuery] string? supplierId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        if (_dbContext == null) return Ok(new { data = new List<object>(), totalCount = 0 });

        var query = _dbContext.StockReceivings
            .AsNoTracking()
            .Include(r => r.Supplier)
            .Include(r => r.RequestedByUser)
            .Include(r => r.ReviewedByUser)
            .Include(r => r.Items)
                .ThenInclude(i => i.Product)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(r =>
                r.ReceivingNumber.ToLower().Contains(s) ||
                (r.ReferenceNumber != null && r.ReferenceNumber.ToLower().Contains(s)) ||
                (r.DeliveryReceiptNumber != null && r.DeliveryReceiptNumber.ToLower().Contains(s)) ||
                (r.ContainerNumber != null && r.ContainerNumber.ToLower().Contains(s)) ||
                (r.Supplier != null && r.Supplier.Name.ToLower().Contains(s)));
        }

        if (status.HasValue)
        {
            query = query.Where(r => r.Status == status.Value);
        }

        if (!string.IsNullOrWhiteSpace(supplierId))
        {
            query = query.Where(r => r.SupplierId == supplierId);
        }

        var totalCount = await query.CountAsync();
        var receivings = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((Math.Max(1, page) - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(new
        {
            data = receivings,
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

        var receiving = await _dbContext.StockReceivings
            .AsNoTracking()
            .Include(r => r.Supplier)
            .Include(r => r.RequestedByUser)
            .Include(r => r.ReviewedByUser)
            .Include(r => r.Items)
                .ThenInclude(i => i.Product)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (receiving == null) return NotFound(new { message = $"Stock receiving report with ID '{id}' not found." });

        return Ok(receiving);
    }

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateStockReceivingDto dto)
    {
        if (_dbContext == null) return StatusCode(503, "Database unavailable.");

        if (string.IsNullOrWhiteSpace(dto.SupplierId))
            return BadRequest(new { message = "Supplier is required." });

        if (dto.Items == null || dto.Items.Count == 0)
            return BadRequest(new { message = "At least one receiving line item is required." });

        var receivingNumber = $"MRR-{DateTime.UtcNow:yyyyMMdd}-{Random.Shared.Next(1000, 9999)}";
        var receivingId = Guid.NewGuid().ToString();

        // Check first active user to associate if none specified
        var userId = dto.RequestedByUserId;
        if (string.IsNullOrWhiteSpace(userId))
        {
            var defaultUser = await _dbContext.Users.FirstOrDefaultAsync();
            userId = defaultUser?.Id ?? "usr-001";
        }

        var receiving = new StockReceiving
        {
            Id = receivingId,
            ReceivingNumber = receivingNumber,
            SupplierId = dto.SupplierId,
            ContainerNumber = dto.ContainerNumber ?? string.Empty,
            StockNumber = dto.StockNumber ?? string.Empty,
            ReferenceNumber = dto.ReferenceNumber ?? string.Empty,
            DeliveryReceiptNumber = dto.DeliveryReceiptNumber,
            DeliveryDate = dto.DeliveryDate ?? DateTime.UtcNow,
            Status = dto.AutoApprove ? StockReceivingStatus.Approved : StockReceivingStatus.PendingApproval,
            Notes = dto.Notes,
            RequestedByUserId = userId,
            CreatedAt = DateTime.UtcNow
        };

        foreach (var itemDto in dto.Items)
        {
            var item = new StockReceivingItem
            {
                Id = Guid.NewGuid().ToString(),
                StockReceivingId = receivingId,
                ProductId = itemDto.ProductId,
                Quantity = itemDto.Quantity,
                ExpectedQuantity = itemDto.ExpectedQuantity ?? itemDto.Quantity,
                CostPrice = itemDto.CostPrice,
                SellingPrice = itemDto.SellingPrice,
                Remarks = itemDto.Remarks,
                CreatedAt = DateTime.UtcNow
            };
            receiving.Items.Add(item);

            if (dto.AutoApprove)
            {
                var product = await _dbContext.Products.FindAsync(itemDto.ProductId);
                if (product != null)
                {
                    product.StockQuantity += itemDto.Quantity;
                    if (itemDto.CostPrice > 0) product.CostPrice = itemDto.CostPrice;
                    if (itemDto.SellingPrice > 0) product.UnitPrice = itemDto.SellingPrice;
                    product.UpdatedAt = DateTime.UtcNow;
                }
            }
        }

        _dbContext.StockReceivings.Add(receiving);
        await _dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = receiving.Id }, receiving);
    }

    [HttpPost("{id}/approve")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Approve(string id, [FromBody] ApproveReceivingDto? dto)
    {
        if (_dbContext == null) return StatusCode(503, "Database unavailable.");

        var receiving = await _dbContext.StockReceivings
            .Include(r => r.Items)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (receiving == null) return NotFound(new { message = $"Stock receiving report '{id}' not found." });

        if (receiving.Status == StockReceivingStatus.Approved)
            return BadRequest(new { message = "Receiving report has already been approved." });

        receiving.Status = StockReceivingStatus.Approved;
        receiving.ReviewedByUserId = dto?.ReviewedByUserId;
        receiving.ReviewedAt = DateTime.UtcNow;
        receiving.ApprovalNotes = dto?.ApprovalNotes;
        receiving.UpdatedAt = DateTime.UtcNow;

        // Apply inventory increment for each item
        foreach (var item in receiving.Items)
        {
            var product = await _dbContext.Products.FindAsync(item.ProductId);
            if (product != null)
            {
                product.StockQuantity += item.Quantity;
                if (item.CostPrice > 0) product.CostPrice = item.CostPrice;
                if (item.SellingPrice > 0) product.UnitPrice = item.SellingPrice;
                product.UpdatedAt = DateTime.UtcNow;
            }
        }

        await _dbContext.SaveChangesAsync();
        return Ok(new { message = $"Stock receiving report '{receiving.ReceivingNumber}' approved and stock updated successfully." });
    }

    [HttpPost("{id}/reject")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Reject(string id, [FromBody] RejectReceivingDto dto)
    {
        if (_dbContext == null) return StatusCode(503, "Database unavailable.");

        var receiving = await _dbContext.StockReceivings.FindAsync(id);
        if (receiving == null) return NotFound(new { message = $"Stock receiving report '{id}' not found." });

        receiving.Status = StockReceivingStatus.Rejected;
        receiving.RejectionReason = dto.RejectionReason ?? "Rejected by authorized manager";
        receiving.ReviewedByUserId = dto.ReviewedByUserId;
        receiving.ReviewedAt = DateTime.UtcNow;
        receiving.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();
        return Ok(new { message = $"Stock receiving report '{receiving.ReceivingNumber}' rejected." });
    }
}

public class CreateStockReceivingDto
{
    public string SupplierId { get; set; } = string.Empty;
    public string? ContainerNumber { get; set; }
    public string? StockNumber { get; set; }
    public string? ReferenceNumber { get; set; }
    public string? DeliveryReceiptNumber { get; set; }
    public DateTime? DeliveryDate { get; set; }
    public string? Notes { get; set; }
    public string? RequestedByUserId { get; set; }
    public bool AutoApprove { get; set; } = false;
    public List<CreateStockReceivingItemDto> Items { get; set; } = new();
}

public class CreateStockReceivingItemDto
{
    public string ProductId { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public int? ExpectedQuantity { get; set; }
    public decimal CostPrice { get; set; }
    public decimal SellingPrice { get; set; }
    public string? Remarks { get; set; }
}

public class ApproveReceivingDto
{
    public string? ReviewedByUserId { get; set; }
    public string? ApprovalNotes { get; set; }
}

public class RejectReceivingDto
{
    public string? ReviewedByUserId { get; set; }
    public string? RejectionReason { get; set; }
}

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

public class CreateSaleRequestDto
{
    public string? CustomerId { get; set; }
    public string? CustomerName { get; set; }
    public string UserId { get; set; } = string.Empty;
    public decimal SubTotal { get; set; }
    public decimal DiscountPercent { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal AmountPaid { get; set; }
    public decimal ChangeAmount { get; set; }
    public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.Cash;
    public string? Notes { get; set; }
    public List<CreateSaleItemDto> Items { get; set; } = new();
}

public class CreateSaleItemDto
{
    public string ProductId { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public int Quantity { get; set; } = 1;
    public decimal UnitPrice { get; set; }
    public decimal LineTotal { get; set; }
    public decimal WeightInTons { get; set; }
}

[ApiController]
[Route("api/[controller]")]
public class SalesController : ControllerBase
{
    private readonly SteelTrackDbContext? _dbContext;

    public SalesController(SteelTrackDbContext? dbContext = null)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? customerId,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        if (_dbContext == null) return Ok(new { data = new List<object>(), totalCount = 0 });

        var query = _dbContext.Sales
            .AsNoTracking()
            .Include(s => s.Customer)
            .Include(s => s.Items)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(customerId))
        {
            query = query.Where(s => s.CustomerId == customerId);
        }

        if (fromDate.HasValue)
        {
            query = query.Where(s => s.CreatedAt >= fromDate.Value);
        }

        if (toDate.HasValue)
        {
            query = query.Where(s => s.CreatedAt <= toDate.Value);
        }

        var totalCount = await query.CountAsync();
        var sales = await query
            .OrderByDescending(s => s.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(s => new
            {
                s.Id,
                s.SaleNumber,
                s.CustomerId,
                CustomerName = s.Customer != null ? s.Customer.Name : s.CustomerName,
                s.SubTotal,
                s.DiscountAmount,
                s.TaxAmount,
                s.TotalAmount,
                s.AmountPaid,
                s.ChangeAmount,
                PaymentMethod = s.PaymentMethod.ToString(),
                s.Status,
                ItemCount = s.Items.Count,
                s.CreatedAt
            })
            .ToListAsync();

        return Ok(new { data = sales, totalCount, page, pageSize });
    }

    [HttpGet("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(string id)
    {
        if (_dbContext == null) return NotFound();

        var sale = await _dbContext.Sales
            .AsNoTracking()
            .Include(s => s.Customer)
            .Include(s => s.Items)
            .ThenInclude(i => i.Product)
            .Include(s => s.Payments)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (sale == null) return NotFound(new { message = $"Sale with ID '{id}' not found." });

        return Ok(sale);
    }

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateSaleRequestDto dto)
    {
        if (_dbContext == null) return StatusCode(503, "Database unavailable.");

        if (dto.Items == null || dto.Items.Count == 0)
        {
            return BadRequest(new { message = "At least one sale line item is required." });
        }

        var saleNumber = $"INV-{DateTime.UtcNow:yyyyMMdd}-{Random.Shared.Next(1000, 9999)}";
        var saleId = Guid.NewGuid().ToString();

        var sale = new Sale
        {
            Id = saleId,
            SaleNumber = saleNumber,
            CustomerId = dto.CustomerId,
            CustomerName = dto.CustomerName,
            UserId = string.IsNullOrWhiteSpace(dto.UserId) ? "usr-001" : dto.UserId,
            SubTotal = dto.SubTotal,
            DiscountPercent = dto.DiscountPercent,
            DiscountAmount = dto.DiscountAmount,
            TaxAmount = dto.TaxAmount,
            TotalAmount = dto.TotalAmount,
            AmountPaid = dto.AmountPaid,
            ChangeAmount = dto.ChangeAmount,
            PaymentMethod = dto.PaymentMethod,
            Notes = dto.Notes,
            Status = 1, // Completed
            CreatedAt = DateTime.UtcNow
        };

        foreach (var item in dto.Items)
        {
            var saleItem = new SaleItem
            {
                Id = Guid.NewGuid().ToString(),
                SaleId = saleId,
                ProductId = item.ProductId,
                ProductName = item.ProductName,
                Quantity = item.Quantity,
                UnitPrice = item.UnitPrice,
                LineTotal = item.LineTotal,
                CreatedAt = DateTime.UtcNow
            };
            sale.Items.Add(saleItem);

            // Decrement product inventory if product exists in catalog
            var prod = await _dbContext.Products.FindAsync(item.ProductId);
            if (prod != null)
            {
                prod.StockQuantity = Math.Max(0, prod.StockQuantity - item.Quantity);
                prod.UpdatedAt = DateTime.UtcNow;
            }
        }

        // Add payment record
        sale.Payments.Add(new SalePayment
        {
            Id = Guid.NewGuid().ToString(),
            SaleId = saleId,
            Amount = dto.AmountPaid > 0 ? dto.AmountPaid : dto.TotalAmount,
            Method = dto.PaymentMethod,
            DatePaid = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        });

        _dbContext.Sales.Add(sale);
        await _dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = sale.Id }, sale);
    }

    [HttpPut("{id}/void")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> VoidSale(string id, [FromQuery] string? reason)
    {
        if (_dbContext == null) return StatusCode(503, "Database unavailable.");

        var sale = await _dbContext.Sales.Include(s => s.Items).FirstOrDefaultAsync(s => s.Id == id);
        if (sale == null) return NotFound(new { message = $"Sale with ID '{id}' not found." });

        sale.Status = 2; // Voided
        sale.VoidReason = reason ?? "Voided by cashier/manager override";
        sale.VoidedAt = DateTime.UtcNow;
        sale.UpdatedAt = DateTime.UtcNow;

        // Restore inventory for voided items
        foreach (var item in sale.Items)
        {
            var prod = await _dbContext.Products.FindAsync(item.ProductId);
            if (prod != null)
            {
                prod.StockQuantity += item.Quantity;
                prod.UpdatedAt = DateTime.UtcNow;
            }
        }

        await _dbContext.SaveChangesAsync();
        return Ok(new { message = $"Sale '{sale.SaleNumber}' has been voided successfully." });
    }
}

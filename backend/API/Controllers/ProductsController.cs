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
public class ProductsController : ControllerBase
{
    private readonly SteelTrackDbContext? _dbContext;

    public ProductsController(SteelTrackDbContext? dbContext = null)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] string? categoryId,
        [FromQuery] string? grade,
        [FromQuery] bool? lowStockOnly,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        if (_dbContext == null) return Ok(new { data = new List<object>(), totalCount = 0 });

        var query = _dbContext.Products
            .AsNoTracking()
            .Include(p => p.Category)
            .Include(p => p.Supplier)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(p =>
                p.Name.ToLower().Contains(s) ||
                p.Sku.ToLower().Contains(s) ||
                (p.Barcode != null && p.Barcode.ToLower().Contains(s)) ||
                (p.Grade != null && p.Grade.ToLower().Contains(s)) ||
                (p.Size != null && p.Size.ToLower().Contains(s)));
        }

        if (!string.IsNullOrWhiteSpace(categoryId))
        {
            query = query.Where(p => p.CategoryId == categoryId);
        }

        if (!string.IsNullOrWhiteSpace(grade))
        {
            query = query.Where(p => p.Grade == grade);
        }

        if (lowStockOnly == true)
        {
            query = query.Where(p => p.StockQuantity <= p.ReorderLevel);
        }

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderBy(p => p.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new
            {
                p.Id,
                p.Sku,
                p.Name,
                p.Description,
                p.Barcode,
                p.Size,
                p.Thickness,
                p.Length,
                p.Grade,
                p.UnitOfMeasure,
                p.UnitPrice,
                p.CostPrice,
                p.StockQuantity,
                p.ReorderLevel,
                p.IsActive,
                p.CategoryId,
                CategoryName = p.Category != null ? p.Category.Name : null,
                p.SupplierId,
                SupplierName = p.Supplier != null ? p.Supplier.Name : null,
                p.CreatedAt,
                p.UpdatedAt
            })
            .ToListAsync();

        return Ok(new { data = items, totalCount, page, pageSize });
    }

    [HttpGet("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(string id)
    {
        if (_dbContext == null) return NotFound();

        var p = await _dbContext.Products
            .AsNoTracking()
            .Include(x => x.Category)
            .Include(x => x.Supplier)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (p == null) return NotFound(new { message = $"Product with ID '{id}' not found." });

        return Ok(p);
    }

    [HttpGet("barcode/{barcode}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetByBarcode(string barcode)
    {
        if (_dbContext == null) return NotFound();

        var p = await _dbContext.Products
            .AsNoTracking()
            .Include(x => x.Category)
            .FirstOrDefaultAsync(x => x.Barcode == barcode);

        if (p == null) return NotFound(new { message = $"Product with barcode '{barcode}' not found." });

        return Ok(p);
    }

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] Product product)
    {
        if (_dbContext == null) return StatusCode(503, "Database unavailable.");

        if (string.IsNullOrWhiteSpace(product.Name) || string.IsNullOrWhiteSpace(product.Sku))
        {
            return BadRequest(new { message = "Product Name and Sku are required." });
        }

        if (string.IsNullOrWhiteSpace(product.Id))
        {
            product.Id = Guid.NewGuid().ToString();
        }

        product.CreatedAt = DateTime.UtcNow;
        _dbContext.Products.Add(product);
        await _dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = product.Id }, product);
    }

    [HttpPut("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(string id, [FromBody] Product product)
    {
        if (_dbContext == null) return StatusCode(503, "Database unavailable.");

        var existing = await _dbContext.Products.FindAsync(id);
        if (existing == null) return NotFound(new { message = $"Product with ID '{id}' not found." });

        existing.Name = product.Name;
        existing.Description = product.Description;
        existing.Sku = product.Sku;
        existing.Barcode = product.Barcode;
        existing.Size = product.Size;
        existing.Thickness = product.Thickness;
        existing.Length = product.Length;
        existing.Grade = product.Grade;
        existing.UnitPrice = product.UnitPrice;
        existing.CostPrice = product.CostPrice;
        existing.StockQuantity = product.StockQuantity;
        existing.ReorderLevel = product.ReorderLevel;
        existing.IsActive = product.IsActive;
        existing.CategoryId = product.CategoryId;
        existing.SupplierId = product.SupplierId;
        existing.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();
        return Ok(existing);
    }

    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(string id)
    {
        if (_dbContext == null) return StatusCode(503, "Database unavailable.");

        var existing = await _dbContext.Products.FindAsync(id);
        if (existing == null) return NotFound(new { message = $"Product with ID '{id}' not found." });

        _dbContext.Products.Remove(existing);
        await _dbContext.SaveChangesAsync();
        return Ok(new { message = $"Product '{existing.Name}' deleted successfully." });
    }
}

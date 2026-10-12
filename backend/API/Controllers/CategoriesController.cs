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
public class CategoriesController : ControllerBase
{
    private readonly SteelTrackDbContext? _dbContext;

    public CategoriesController(SteelTrackDbContext? dbContext = null)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll([FromQuery] string? search, [FromQuery] bool? includeInactive = false)
    {
        if (_dbContext == null) return Ok(new List<object>());

        var query = _dbContext.Categories
            .AsNoTracking()
            .Include(c => c.Products)
            .AsQueryable();

        if (includeInactive != true)
        {
            query = query.Where(c => c.IsActive);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(c => c.Name.ToLower().Contains(s) || (c.Description != null && c.Description.ToLower().Contains(s)));
        }

        var categories = await query
            .OrderBy(c => c.Name)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.Description,
                c.IsActive,
                c.Icon,
                c.ColorAccent,
                c.ParentCategoryId,
                ProductCount = c.Products.Count,
                c.CreatedAt,
                c.UpdatedAt
            })
            .ToListAsync();

        return Ok(categories);
    }

    [HttpGet("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(string id)
    {
        if (_dbContext == null) return NotFound();

        var category = await _dbContext.Categories
            .AsNoTracking()
            .Include(c => c.Products)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (category == null) return NotFound(new { message = $"Category with ID '{id}' not found." });

        return Ok(category);
    }

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] Category category)
    {
        if (_dbContext == null) return StatusCode(503, "Database unavailable.");

        if (string.IsNullOrWhiteSpace(category.Name))
        {
            return BadRequest(new { message = "Category Name is required." });
        }

        if (string.IsNullOrWhiteSpace(category.Id))
        {
            category.Id = Guid.NewGuid().ToString();
        }

        category.CreatedAt = DateTime.UtcNow;
        _dbContext.Categories.Add(category);
        await _dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = category.Id }, category);
    }

    [HttpPut("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(string id, [FromBody] Category category)
    {
        if (_dbContext == null) return StatusCode(503, "Database unavailable.");

        var existing = await _dbContext.Categories.FindAsync(id);
        if (existing == null) return NotFound(new { message = $"Category with ID '{id}' not found." });

        existing.Name = category.Name;
        existing.Description = category.Description;
        existing.IsActive = category.IsActive;
        existing.Icon = category.Icon;
        existing.ColorAccent = category.ColorAccent;
        existing.ParentCategoryId = category.ParentCategoryId;
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

        var existing = await _dbContext.Categories.FindAsync(id);
        if (existing == null) return NotFound(new { message = $"Category with ID '{id}' not found." });

        _dbContext.Categories.Remove(existing);
        await _dbContext.SaveChangesAsync();
        return Ok(new { message = $"Category '{existing.Name}' deleted successfully." });
    }
}

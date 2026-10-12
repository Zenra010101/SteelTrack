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
public class SuppliersController : ControllerBase
{
    private readonly SteelTrackDbContext? _dbContext;

    public SuppliersController(SteelTrackDbContext? dbContext = null)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll([FromQuery] string? search, [FromQuery] bool? includeInactive = false)
    {
        if (_dbContext == null) return Ok(new List<object>());

        var query = _dbContext.Suppliers.AsNoTracking().AsQueryable();

        if (includeInactive != true)
        {
            query = query.Where(s => s.IsActive);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim().ToLower();
            query = query.Where(s =>
                s.Name.ToLower().Contains(q) ||
                (s.SupplierCode != null && s.SupplierCode.ToLower().Contains(q)) ||
                (s.ContactPerson != null && s.ContactPerson.ToLower().Contains(q)) ||
                (s.Phone != null && s.Phone.ToLower().Contains(q)) ||
                (s.Email != null && s.Email.ToLower().Contains(q)));
        }

        var suppliers = await query
            .OrderBy(s => s.Name)
            .Select(s => new
            {
                s.Id,
                s.SupplierCode,
                s.Name,
                s.ContactPerson,
                s.Phone,
                s.Email,
                s.Address,
                s.PaymentTerms,
                s.CustomPaymentTerms,
                s.IsActive,
                s.Notes,
                s.CreatedAt,
                s.UpdatedAt
            })
            .ToListAsync();

        return Ok(suppliers);
    }

    [HttpGet("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(string id)
    {
        if (_dbContext == null) return NotFound();

        var supplier = await _dbContext.Suppliers
            .AsNoTracking()
            .Include(s => s.Contacts)
            .Include(s => s.Attachments)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (supplier == null) return NotFound(new { message = $"Supplier with ID '{id}' not found." });

        return Ok(supplier);
    }

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] Supplier supplier)
    {
        if (_dbContext == null) return StatusCode(503, "Database unavailable.");

        if (string.IsNullOrWhiteSpace(supplier.Name))
        {
            return BadRequest(new { message = "Supplier Name is required." });
        }

        if (string.IsNullOrWhiteSpace(supplier.Id))
        {
            supplier.Id = Guid.NewGuid().ToString();
        }

        supplier.CreatedAt = DateTime.UtcNow;
        _dbContext.Suppliers.Add(supplier);
        await _dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = supplier.Id }, supplier);
    }

    [HttpPut("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(string id, [FromBody] Supplier supplier)
    {
        if (_dbContext == null) return StatusCode(503, "Database unavailable.");

        var existing = await _dbContext.Suppliers.FindAsync(id);
        if (existing == null) return NotFound(new { message = $"Supplier with ID '{id}' not found." });

        existing.Name = supplier.Name;
        existing.SupplierCode = supplier.SupplierCode;
        existing.ContactPerson = supplier.ContactPerson;
        existing.Phone = supplier.Phone;
        existing.Email = supplier.Email;
        existing.Address = supplier.Address;
        existing.PaymentTerms = supplier.PaymentTerms;
        existing.CustomPaymentTerms = supplier.CustomPaymentTerms;
        existing.IsActive = supplier.IsActive;
        existing.Notes = supplier.Notes;
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

        var existing = await _dbContext.Suppliers.FindAsync(id);
        if (existing == null) return NotFound(new { message = $"Supplier with ID '{id}' not found." });

        _dbContext.Suppliers.Remove(existing);
        await _dbContext.SaveChangesAsync();
        return Ok(new { message = $"Supplier '{existing.Name}' deleted successfully." });
    }
}

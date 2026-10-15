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
public class CustomersController : ControllerBase
{
    private readonly SteelTrackDbContext? _dbContext;

    public CustomersController(SteelTrackDbContext? dbContext = null)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll([FromQuery] string? search, [FromQuery] bool? includeInactive = false)
    {
        if (_dbContext == null) return Ok(new List<object>());

        var query = _dbContext.Customers.AsNoTracking().AsQueryable();

        if (includeInactive != true)
        {
            query = query.Where(c => c.IsActive);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(c =>
                c.Name.ToLower().Contains(s) ||
                (c.CustomerCode != null && c.CustomerCode.ToLower().Contains(s)) ||
                (c.Phone != null && c.Phone.ToLower().Contains(s)) ||
                (c.Email != null && c.Email.ToLower().Contains(s)));
        }

        var customers = await query
            .OrderBy(c => c.Name)
            .Select(c => new
            {
                c.Id,
                c.CustomerCode,
                c.Name,
                c.Phone,
                c.Email,
                c.Address,
                c.CreditLimit,
                c.EnableCredit,
                c.PaymentTerms,
                c.DueDays,
                c.IsBlacklisted,
                c.IsBlocked,
                c.IsActive,
                c.Notes,
                c.CreatedAt,
                c.UpdatedAt
            })
            .ToListAsync();

        return Ok(customers);
    }

    [HttpGet("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(string id)
    {
        if (_dbContext == null) return NotFound();

        var customer = await _dbContext.Customers
            .AsNoTracking()
            .Include(c => c.Receivables)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (customer == null) return NotFound(new { message = $"Customer with ID '{id}' not found." });

        return Ok(customer);
    }

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] Customer customer)
    {
        if (_dbContext == null) return StatusCode(503, "Database unavailable.");

        if (string.IsNullOrWhiteSpace(customer.Name))
        {
            return BadRequest(new { message = "Customer Name is required." });
        }

        if (string.IsNullOrWhiteSpace(customer.Id))
        {
            customer.Id = Guid.NewGuid().ToString();
        }

        customer.CreatedAt = DateTime.UtcNow;
        _dbContext.Customers.Add(customer);
        await _dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = customer.Id }, customer);
    }

    [HttpPut("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(string id, [FromBody] Customer customer)
    {
        if (_dbContext == null) return StatusCode(503, "Database unavailable.");

        var existing = await _dbContext.Customers.FindAsync(id);
        if (existing == null) return NotFound(new { message = $"Customer with ID '{id}' not found." });

        existing.Name = customer.Name;
        existing.CustomerCode = customer.CustomerCode;
        existing.Phone = customer.Phone;
        existing.Email = customer.Email;
        existing.Address = customer.Address;
        existing.CreditLimit = customer.CreditLimit;
        existing.EnableCredit = customer.EnableCredit;
        existing.PaymentTerms = customer.PaymentTerms;
        existing.DueDays = customer.DueDays;
        existing.IsBlacklisted = customer.IsBlacklisted;
        existing.IsBlocked = customer.IsBlocked;
        existing.IsActive = customer.IsActive;
        existing.Notes = customer.Notes;
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

        var existing = await _dbContext.Customers.FindAsync(id);
        if (existing == null) return NotFound(new { message = $"Customer with ID '{id}' not found." });

        _dbContext.Customers.Remove(existing);
        await _dbContext.SaveChangesAsync();
        return Ok(new { message = $"Customer '{existing.Name}' deleted successfully." });
    }

    [HttpPatch("{id}/credit-limit")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateCreditLimit(string id, [FromBody] UpdateCreditLimitDto dto)
    {
        if (_dbContext == null) return StatusCode(503, "Database unavailable.");
        var existing = await _dbContext.Customers.FindAsync(id);
        if (existing == null) return NotFound(new { message = $"Customer with ID '{id}' not found." });

        existing.CreditLimit = dto.CreditLimitPHP;
        if (!string.IsNullOrWhiteSpace(dto.Justification))
        {
            existing.Notes = (existing.Notes ?? "") + $" | Credit Limit updated to ₱{dto.CreditLimitPHP:N0} ({DateTime.UtcNow:yyyy-MM-dd}): {dto.Justification}";
        }
        existing.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();
        return Ok(existing);
    }

    [HttpPatch("{id}/status")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateStatus(string id, [FromBody] UpdateCustomerStatusDto dto)
    {
        if (_dbContext == null) return StatusCode(503, "Database unavailable.");
        var existing = await _dbContext.Customers.FindAsync(id);
        if (existing == null) return NotFound(new { message = $"Customer with ID '{id}' not found." });

        if (dto.Status == "Active")
        {
            existing.IsActive = true;
            existing.IsBlocked = false;
        }
        else if (dto.Status == "Blocked")
        {
            existing.IsActive = false;
            existing.IsBlocked = true;
        }
        else
        {
            existing.IsActive = false;
            existing.IsBlocked = false;
        }
        existing.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();
        return Ok(existing);
    }
}

public class UpdateCreditLimitDto
{
    public decimal CreditLimitPHP { get; set; }
    public string? Justification { get; set; }
}

public class UpdateCustomerStatusDto
{
    public string Status { get; set; } = "Active"; // Active | On Hold | Blocked
}

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

public class UpdateChequeStatusDto
{
    public int Status { get; set; } // 0: Pending, 1: Deposited, 2: Cleared, 3: Bounced
    public string? Remarks { get; set; }
}

[ApiController]
[Route("api/[controller]")]
public class ChequesController : ControllerBase
{
    private readonly SteelTrackDbContext? _dbContext;

    public ChequesController(SteelTrackDbContext? dbContext = null)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] int? status,
        [FromQuery] string? search)
    {
        if (_dbContext == null) return Ok(new List<object>());

        var query = _dbContext.SaleCheques
            .AsNoTracking()
            .Include(c => c.Sale)
            .AsQueryable();

        if (status.HasValue)
        {
            query = query.Where(c => c.Status == status.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(c =>
                c.ChequeNumber.ToLower().Contains(s) ||
                c.BankName.ToLower().Contains(s) ||
                (c.AccountName != null && c.AccountName.ToLower().Contains(s)));
        }

        var cheques = await query
            .OrderBy(c => c.MaturityDate)
            .Select(c => new
            {
                c.Id,
                c.SaleId,
                c.ChequeNumber,
                c.BankName,
                c.Branch,
                c.AccountName,
                c.Amount,
                ChequeDate = c.MaturityDate,
                c.MaturityDate,
                c.Status,
                c.Notes,
                c.CreatedAt
            })
            .ToListAsync();

        return Ok(cheques);
    }

    [HttpGet("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(string id)
    {
        if (_dbContext == null) return NotFound();

        var cheque = await _dbContext.SaleCheques
            .AsNoTracking()
            .Include(c => c.Sale)
            .Include(c => c.BouncedHistories)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (cheque == null) return NotFound(new { message = $"Cheque with ID '{id}' not found." });

        return Ok(cheque);
    }

    [HttpPut("{id}/status")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateStatus(string id, [FromBody] UpdateChequeStatusDto dto)
    {
        if (_dbContext == null) return StatusCode(503, "Database unavailable.");

        var cheque = await _dbContext.SaleCheques.FindAsync(id);
        if (cheque == null) return NotFound(new { message = $"Cheque with ID '{id}' not found." });

        cheque.Status = dto.Status;
        if (!string.IsNullOrWhiteSpace(dto.Remarks))
        {
            cheque.Notes = (cheque.Notes ?? "") + $" | {DateTime.UtcNow:yyyy-MM-dd}: {dto.Remarks}";
        }
        cheque.UpdatedAt = DateTime.UtcNow;

        if (dto.Status == 3) // Bounced
        {
            var history = new BouncedChequeHistory
            {
                Id = Guid.NewGuid().ToString(),
                SaleChequeId = id,
                BouncedDate = DateTime.UtcNow,
                Reason = dto.Remarks ?? "Insufficient funds / DAIF",
                CreatedAt = DateTime.UtcNow
            };
            _dbContext.BouncedChequeHistories.Add(history);
        }

        await _dbContext.SaveChangesAsync();
        return Ok(cheque);
    }
}

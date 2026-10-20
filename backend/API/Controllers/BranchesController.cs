using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using GensanPOS.Domain.Entities;
using GensanPOS.Infrastructure.Persistence;

namespace SteelTrack.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BranchesController : ControllerBase
{
    private readonly AppDbContext? _dbContext;

    private static readonly List<Branch> _fallbackBranches = new()
    {
        new Branch
        {
            Id = Guid.Parse("11111111-1111-1111-1111-111111111111"),
            Code = "DVO",
            Name = "Davao",
            Address = "J.P. Laurel Ave, Bajada, Davao City",
            IsActive = true,
            CreatedAt = DateTime.UtcNow.AddMonths(-6)
        },
        new Branch
        {
            Id = Guid.Parse("22222222-2222-2222-2222-222222222222"),
            Code = "MND",
            Name = "Mandaue",
            Address = "A.C. Cortes Ave, Mandaue City, Cebu",
            IsActive = true,
            CreatedAt = DateTime.UtcNow.AddMonths(-6)
        },
        new Branch
        {
            Id = Guid.Parse("33333333-3333-3333-3333-333333333333"),
            Code = "CEB",
            Name = "Cebu",
            Address = "North Reclamation Area, Cebu City",
            IsActive = true,
            CreatedAt = DateTime.UtcNow.AddMonths(-6)
        },
        new Branch
        {
            Id = Guid.Parse("44444444-4444-4444-4444-444444444444"),
            Code = "CGY",
            Name = "Cagayan",
            Address = "CM Recto Ave, Lapasan, Cagayan de Oro City",
            IsActive = true,
            CreatedAt = DateTime.UtcNow.AddMonths(-6)
        }
    };

    public BranchesController(AppDbContext? dbContext = null)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll()
    {
        if (_dbContext != null)
        {
            try
            {
                var dbBranches = await _dbContext.Branches.AsNoTracking().OrderBy(b => b.Name).ToListAsync();
                if (dbBranches.Any()) return Ok(dbBranches);
            }
            catch
            {
                // Fallback to in-memory if DB connection is unavailable
            }
        }
        return Ok(_fallbackBranches);
    }

    [HttpGet("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(string id)
    {
        if (_dbContext != null && Guid.TryParse(id, out var branchGuid))
        {
            try
            {
                var branch = await _dbContext.Branches.FindAsync(branchGuid);
                if (branch != null) return Ok(branch);
            }
            catch { }
        }

        var fallback = _fallbackBranches.FirstOrDefault(b => b.Id.ToString().Equals(id, StringComparison.OrdinalIgnoreCase) || b.Code.Equals(id, StringComparison.OrdinalIgnoreCase));
        if (fallback == null) return NotFound(new { message = $"Branch with ID '{id}' not found." });
        return Ok(fallback);
    }

    [HttpPut("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(string id, [FromBody] UpdateBranchRequest request)
    {
        if (_dbContext != null && Guid.TryParse(id, out var branchGuid))
        {
            try
            {
                var branch = await _dbContext.Branches.FindAsync(branchGuid);
                if (branch != null)
                {
                    if (!string.IsNullOrWhiteSpace(request.Name)) branch.Name = request.Name.Trim();
                    if (request.Address != null) branch.Address = request.Address.Trim();
                    if (request.IsActive.HasValue) branch.IsActive = request.IsActive.Value;
                    branch.UpdatedAt = DateTime.UtcNow;

                    await _dbContext.SaveChangesAsync();
                    return Ok(branch);
                }
            }
            catch { }
        }

        var fallback = _fallbackBranches.FirstOrDefault(b => b.Id.ToString().Equals(id, StringComparison.OrdinalIgnoreCase) || b.Code.Equals(id, StringComparison.OrdinalIgnoreCase));
        if (fallback == null) return NotFound(new { message = $"Branch with ID '{id}' not found." });

        if (!string.IsNullOrWhiteSpace(request.Name)) fallback.Name = request.Name.Trim();
        if (request.Address != null) fallback.Address = request.Address.Trim();
        if (request.IsActive.HasValue) fallback.IsActive = request.IsActive.Value;
        fallback.UpdatedAt = DateTime.UtcNow;

        return Ok(fallback);
    }

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateBranchRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Code))
        {
            return BadRequest(new { message = "Branch Name and Code are required." });
        }

        var newBranch = new Branch
        {
            Id = Guid.NewGuid(),
            Code = request.Code.Trim().ToUpperInvariant(),
            Name = request.Name.Trim(),
            Address = request.Address?.Trim(),
            IsActive = request.IsActive ?? true,
            CreatedAt = DateTime.UtcNow
        };

        if (_dbContext != null)
        {
            try
            {
                await _dbContext.Branches.AddAsync(newBranch);
                await _dbContext.SaveChangesAsync();
                return CreatedAtAction(nameof(GetById), new { id = newBranch.Id }, newBranch);
            }
            catch { }
        }

        _fallbackBranches.Add(newBranch);
        return CreatedAtAction(nameof(GetById), new { id = newBranch.Id }, newBranch);
    }
}

public class UpdateBranchRequest
{
    public string? Name { get; set; }
    public string? Address { get; set; }
    public string? ContactNumber { get; set; }
    public string? ManagerName { get; set; }
    public bool? IsActive { get; set; }
}

public class CreateBranchRequest
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? ContactNumber { get; set; }
    public string? ManagerName { get; set; }
    public bool? IsActive { get; set; }
}

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
public class UsersController : ControllerBase
{
    private readonly SteelTrackDbContext? _dbContext;

    public UsersController(SteelTrackDbContext? dbContext = null)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] string? branchId,
        [FromQuery] string? roleId,
        [FromQuery] bool? isActive)
    {
        if (_dbContext == null) return Ok(new List<object>());

        var query = _dbContext.Users
            .AsNoTracking()
            .Include(u => u.Role)
                .ThenInclude(r => r.Branch)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(u =>
                u.FullName.ToLower().Contains(s) ||
                u.Email.ToLower().Contains(s));
        }

        if (!string.IsNullOrWhiteSpace(branchId))
        {
            query = query.Where(u => u.Role.BranchId == branchId);
        }

        if (!string.IsNullOrWhiteSpace(roleId))
        {
            query = query.Where(u => u.RoleId == roleId);
        }

        if (isActive.HasValue)
        {
            query = query.Where(u => u.IsActive == isActive.Value);
        }

        var users = await query
            .OrderBy(u => u.FullName)
            .Select(u => new
            {
                u.Id,
                u.Email,
                u.FullName,
                u.IsActive,
                u.RoleId,
                RoleName = u.Role != null ? u.Role.Name : string.Empty,
                BranchId = u.Role != null ? u.Role.BranchId : null,
                BranchName = u.Role != null && u.Role.Branch != null ? u.Role.Branch.Name : null,
                BranchCode = u.Role != null && u.Role.Branch != null ? u.Role.Branch.Code : null,
                u.CreatedAt,
                u.UpdatedAt
            })
            .ToListAsync();

        return Ok(users);
    }

    [HttpGet("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(string id)
    {
        if (_dbContext == null) return NotFound();

        var user = await _dbContext.Users
            .AsNoTracking()
            .Include(u => u.Role)
                .ThenInclude(r => r.Branch)
            .FirstOrDefaultAsync(u => u.Id == id);

        if (user == null) return NotFound(new { message = $"User with ID '{id}' not found." });

        return Ok(new
        {
            user.Id,
            user.Email,
            user.FullName,
            user.IsActive,
            user.RoleId,
            RoleName = user.Role?.Name,
            BranchId = user.Role?.BranchId,
            BranchName = user.Role?.Branch?.Name,
            BranchCode = user.Role?.Branch?.Code,
            user.CreatedAt,
            user.UpdatedAt
        });
    }

    [HttpGet("roles")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetRoles()
    {
        if (_dbContext == null) return Ok(new List<object>());

        var roles = await _dbContext.Roles
            .AsNoTracking()
            .Include(r => r.Branch)
            .OrderBy(r => r.Name)
            .Select(r => new
            {
                r.Id,
                r.Name,
                r.Description,
                r.BranchId,
                BranchName = r.Branch != null ? r.Branch.Name : null
            })
            .ToListAsync();

        return Ok(roles);
    }

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest request)
    {
        if (_dbContext == null) return StatusCode(503, "Database unavailable");

        if (string.IsNullOrWhiteSpace(request.Email))
            return BadRequest(new { message = "Email is required." });

        var emailExists = await _dbContext.Users.AnyAsync(u => u.Email.ToLower() == request.Email.Trim().ToLower());
        if (emailExists)
            return BadRequest(new { message = $"A user with email '{request.Email}' already exists." });

        var user = new User
        {
            Id = Guid.NewGuid().ToString(),
            Email = request.Email.Trim().ToLower(),
            FullName = request.FullName?.Trim() ?? string.Empty,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(string.IsNullOrWhiteSpace(request.Password) ? "SteelTrack@2025" : request.Password),
            RoleId = request.RoleId,
            IsActive = request.IsActive,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.Users.Add(user);
        await _dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = user.Id }, new
        {
            user.Id,
            user.Email,
            user.FullName,
            user.RoleId,
            user.IsActive,
            user.CreatedAt
        });
    }

    [HttpPut("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(string id, [FromBody] UpdateUserRequest request)
    {
        if (_dbContext == null) return StatusCode(503, "Database unavailable");

        var user = await _dbContext.Users.FindAsync(id);
        if (user == null) return NotFound(new { message = $"User with ID '{id}' not found." });

        if (!string.IsNullOrWhiteSpace(request.FullName))
            user.FullName = request.FullName.Trim();

        if (!string.IsNullOrWhiteSpace(request.RoleId))
            user.RoleId = request.RoleId;

        if (request.IsActive.HasValue)
            user.IsActive = request.IsActive.Value;

        if (!string.IsNullOrWhiteSpace(request.Password))
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);

        user.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            user.Id,
            user.Email,
            user.FullName,
            user.RoleId,
            user.IsActive,
            user.UpdatedAt
        });
    }

    [HttpPatch("{id}/status")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ToggleStatus(string id)
    {
        if (_dbContext == null) return StatusCode(503, "Database unavailable");

        var user = await _dbContext.Users.FindAsync(id);
        if (user == null) return NotFound(new { message = $"User with ID '{id}' not found." });

        user.IsActive = !user.IsActive;
        user.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();

        return Ok(new { user.Id, user.IsActive });
    }
}

public class CreateUserRequest
{
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string RoleId { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}

public class UpdateUserRequest
{
    public string? FullName { get; set; }
    public string? RoleId { get; set; }
    public bool? IsActive { get; set; }
    public string? Password { get; set; }
}

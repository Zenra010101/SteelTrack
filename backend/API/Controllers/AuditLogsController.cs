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
public class AuditLogsController : ControllerBase
{
    private readonly SteelTrackDbContext? _dbContext;

    public AuditLogsController(SteelTrackDbContext? dbContext = null)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Search(
        [FromQuery] string? search,
        [FromQuery] string? action,
        [FromQuery] string? entityType,
        [FromQuery] string? userId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        if (_dbContext == null) return Ok(new { data = new List<object>(), totalCount = 0 });

        var query = _dbContext.AuditLogs.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(l =>
                l.Action.ToLower().Contains(s) ||
                l.EntityType.ToLower().Contains(s) ||
                (l.UserEmail != null && l.UserEmail.ToLower().Contains(s)) ||
                (l.Details != null && l.Details.ToLower().Contains(s)));
        }

        if (!string.IsNullOrWhiteSpace(action))
        {
            query = query.Where(l => l.Action == action);
        }

        if (!string.IsNullOrWhiteSpace(entityType))
        {
            query = query.Where(l => l.EntityType == entityType);
        }

        if (!string.IsNullOrWhiteSpace(userId))
        {
            query = query.Where(l => l.UserId == userId);
        }

        if (from.HasValue)
        {
            query = query.Where(l => l.CreatedAt >= from.Value);
        }

        if (to.HasValue)
        {
            query = query.Where(l => l.CreatedAt <= to.Value);
        }

        var totalCount = await query.CountAsync();
        var logs = await query
            .OrderByDescending(l => l.CreatedAt)
            .Skip((Math.Max(1, page) - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(new
        {
            data = logs,
            totalCount,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
        });
    }

    [HttpGet("recent")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetRecent([FromQuery] int count = 20)
    {
        if (_dbContext == null) return Ok(new List<object>());

        var logs = await _dbContext.AuditLogs
            .AsNoTracking()
            .OrderByDescending(l => l.CreatedAt)
            .Take(Math.Min(100, Math.Max(1, count)))
            .ToListAsync();

        return Ok(logs);
    }

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateAuditLogDto dto)
    {
        if (_dbContext == null) return StatusCode(503, "Database unavailable.");

        if (string.IsNullOrWhiteSpace(dto.Action))
        {
            return BadRequest(new { message = "Action is required." });
        }

        var log = new AuditLog
        {
            Id = Guid.NewGuid().ToString(),
            UserId = dto.UserId,
            UserEmail = dto.UserEmail,
            Action = dto.Action,
            EntityType = dto.EntityType ?? "General",
            EntityId = dto.EntityId,
            Details = dto.Details,
            IpAddress = dto.IpAddress ?? HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = dto.UserAgent ?? Request.Headers.UserAgent.ToString(),
            Status = dto.Status ?? "SUCCESS",
            OldValue = dto.OldValue,
            NewValue = dto.NewValue,
            Category = dto.Category ?? 1,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.AuditLogs.Add(log);
        await _dbContext.SaveChangesAsync();

        return StatusCode(StatusCodes.Status201Created, log);
    }
}

public class CreateAuditLogDto
{
    public string? UserId { get; set; }
    public string? UserEmail { get; set; }
    public string Action { get; set; } = string.Empty;
    public string? EntityType { get; set; }
    public string? EntityId { get; set; }
    public string? Details { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public string? Status { get; set; }
    public string? OldValue { get; set; }
    public string? NewValue { get; set; }
    public int? Category { get; set; }
}

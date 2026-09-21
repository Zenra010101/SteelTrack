using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using SteelTrack.Application.DTOs;
using SteelTrack.Application.Interfaces;
using SteelTrack.Domain.Enums;

namespace SteelTrack.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class InventoryController : ControllerBase
{
    private readonly IInventoryService _inventoryService;

    public InventoryController(IInventoryService inventoryService)
    {
        _inventoryService = inventoryService;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll([FromQuery] string? search, [FromQuery] SteelGrade? grade, [FromQuery] BatchStatus? status)
    {
        var result = await _inventoryService.GetInventoryAsync(search, grade, status);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var batch = await _inventoryService.GetBatchByIdAsync(id);
        if (batch == null) return NotFound(new { message = $"Steel batch with ID {id} not found." });
        return Ok(batch);
    }

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateSteelBatchDto dto)
    {
        if (dto.WeightInTons <= 0)
        {
            return BadRequest(new { message = "Weight in tons must be greater than zero." });
        }

        var created = await _inventoryService.CreateBatchAsync(dto);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id:guid}/status")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateBatchStatusDto dto)
    {
        var updated = await _inventoryService.UpdateStatusAsync(id, dto);
        if (updated == null) return NotFound(new { message = $"Steel batch with ID {id} not found." });
        return Ok(updated);
    }

    [HttpGet("stats")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetStats()
    {
        var stats = await _inventoryService.GetStatsAsync();
        return Ok(stats);
    }
}

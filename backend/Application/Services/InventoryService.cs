using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using SteelTrack.Application.DTOs;
using SteelTrack.Application.Interfaces;
using SteelTrack.Domain.Entities;
using SteelTrack.Domain.Enums;

namespace SteelTrack.Application.Services;

public class InventoryService : IInventoryService
{
    private readonly ISteelRepository _repository;

    public InventoryService(ISteelRepository repository)
    {
        _repository = repository;
    }

    public async Task<IEnumerable<SteelBatchDto>> GetInventoryAsync(string? search = null, SteelGrade? grade = null, BatchStatus? status = null)
    {
        var batches = await _repository.GetAllAsync(search, grade, status);
        return batches.Select(MapToDto);
    }

    public async Task<SteelBatchDto?> GetBatchByIdAsync(Guid id)
    {
        var batch = await _repository.GetByIdAsync(id);
        return batch == null ? null : MapToDto(batch);
    }

    public async Task<SteelBatchDto> CreateBatchAsync(CreateSteelBatchDto dto)
    {
        var batch = new SteelBatch
        {
            HeatNumber = string.IsNullOrWhiteSpace(dto.HeatNumber) ? $"HT-{DateTime.UtcNow:yyyyMMdd}-{Random.Shared.Next(1000, 9999)}" : dto.HeatNumber,
            Grade = dto.Grade,
            WeightInTons = dto.WeightInTons,
            Dimensions = dto.Dimensions,
            Location = dto.Location,
            Status = BatchStatus.InProduction,
            CreatedAt = DateTime.UtcNow
        };

        var created = await _repository.AddAsync(batch);
        return MapToDto(created);
    }

    public async Task<SteelBatchDto?> UpdateStatusAsync(Guid id, UpdateBatchStatusDto dto)
    {
        var batch = await _repository.GetByIdAsync(id);
        if (batch == null) return null;

        batch.Status = dto.Status;
        if (!string.IsNullOrWhiteSpace(dto.NewLocation))
        {
            batch.Location = dto.NewLocation;
        }
        batch.LastUpdated = DateTime.UtcNow;

        var updated = await _repository.UpdateAsync(batch);
        return updated == null ? null : MapToDto(updated);
    }

    public async Task<InventoryStatsDto> GetStatsAsync()
    {
        var statusCounts = await _repository.GetStatusCountsAsync();
        var totalTonnage = await _repository.GetTotalTonnageAsync();
        var totalBatches = statusCounts.Values.Sum();

        return new InventoryStatsDto
        {
            TotalBatches = totalBatches,
            TotalTonnage = Math.Round(totalTonnage, 2),
            InProductionCount = statusCounts.GetValueOrDefault(BatchStatus.InProduction, 0),
            QualityCheckCount = statusCounts.GetValueOrDefault(BatchStatus.QualityCheck, 0),
            AvailableCount = statusCounts.GetValueOrDefault(BatchStatus.Available, 0),
            ShippedCount = statusCounts.GetValueOrDefault(BatchStatus.Shipped, 0)
        };
    }

    private static SteelBatchDto MapToDto(SteelBatch batch)
    {
        return new SteelBatchDto
        {
            Id = batch.Id,
            HeatNumber = batch.HeatNumber,
            Grade = batch.Grade.ToString(),
            WeightInTons = batch.WeightInTons,
            Dimensions = batch.Dimensions,
            Status = batch.Status.ToString(),
            Location = batch.Location,
            CreatedAt = batch.CreatedAt,
            LastUpdated = batch.LastUpdated
        };
    }
}

using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using SteelTrack.Application.DTOs;
using SteelTrack.Domain.Enums;

namespace SteelTrack.Application.Interfaces;

public interface ISteelInventoryService
{
    Task<IEnumerable<SteelBatchDto>> GetInventoryAsync(string? search = null, SteelGrade? grade = null, BatchStatus? status = null);
    Task<SteelBatchDto?> GetBatchByIdAsync(Guid id);
    Task<SteelBatchDto> CreateBatchAsync(CreateSteelBatchDto dto);
    Task<SteelBatchDto?> UpdateStatusAsync(Guid id, UpdateBatchStatusDto dto);
    Task<InventoryStatsDto> GetStatsAsync();
}

using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using SteelTrack.Domain.Entities;
using SteelTrack.Domain.Enums;

namespace SteelTrack.Application.Interfaces;

public interface ISteelRepository
{
    Task<IEnumerable<SteelBatch>> GetAllAsync(string? search = null, SteelGrade? grade = null, BatchStatus? status = null);
    Task<SteelBatch?> GetByIdAsync(Guid id);
    Task<SteelBatch> AddAsync(SteelBatch batch);
    Task<SteelBatch?> UpdateAsync(SteelBatch batch);
    Task<bool> DeleteAsync(Guid id);
    Task<Dictionary<BatchStatus, int>> GetStatusCountsAsync();
    Task<double> GetTotalTonnageAsync();
}

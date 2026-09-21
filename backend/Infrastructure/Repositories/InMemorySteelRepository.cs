using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using SteelTrack.Application.Interfaces;
using SteelTrack.Domain.Entities;
using SteelTrack.Domain.Enums;

namespace SteelTrack.Infrastructure.Repositories;

public class InMemorySteelRepository : ISteelRepository
{
    private readonly ConcurrentDictionary<Guid, SteelBatch> _store = new();

    public InMemorySteelRepository()
    {
        SeedData();
    }

    private void SeedData()
    {
        var sampleData = new List<SteelBatch>
        {
            new SteelBatch
            {
                Id = Guid.Parse("11111111-1111-1111-1111-111111111111"),
                HeatNumber = "HT-2026-8841",
                Grade = SteelGrade.A36_Structural,
                WeightInTons = 14.5,
                Dimensions = "12mm x 1500mm x 6000mm",
                Status = BatchStatus.Available,
                Location = "Yard A - Bay 02",
                CreatedAt = DateTime.UtcNow.AddDays(-5)
            },
            new SteelBatch
            {
                Id = Guid.Parse("22222222-2222-2222-2222-222222222222"),
                HeatNumber = "HT-2026-9012",
                Grade = SteelGrade.SS304_Stainless,
                WeightInTons = 8.2,
                Dimensions = "6mm x 1220mm x 3000mm",
                Status = BatchStatus.QualityCheck,
                Location = "Testing Lab B",
                CreatedAt = DateTime.UtcNow.AddDays(-2)
            },
            new SteelBatch
            {
                Id = Guid.Parse("33333333-3333-3333-3333-333333333333"),
                HeatNumber = "HT-2026-9504",
                Grade = SteelGrade.A572_HighStrength,
                WeightInTons = 22.0,
                Dimensions = "25mm x 2000mm x 12000mm",
                Status = BatchStatus.InProduction,
                Location = "Mill Line #1",
                CreatedAt = DateTime.UtcNow.AddHours(-12)
            },
            new SteelBatch
            {
                Id = Guid.Parse("44444444-4444-4444-4444-444444444444"),
                HeatNumber = "HT-2026-7731",
                Grade = SteelGrade.AISI1045_Carbon,
                WeightInTons = 18.7,
                Dimensions = "50mm x 1000mm x 4000mm",
                Status = BatchStatus.Reserved,
                Location = "Yard C - Dock 1",
                CreatedAt = DateTime.UtcNow.AddDays(-8)
            },
            new SteelBatch
            {
                Id = Guid.Parse("55555555-5555-5555-5555-555555555555"),
                HeatNumber = "HT-2026-6109",
                Grade = SteelGrade.SS316_Stainless,
                WeightInTons = 11.4,
                Dimensions = "8mm x 1500mm x 6000mm",
                Status = BatchStatus.Shipped,
                Location = "In Transit - Truck 409",
                CreatedAt = DateTime.UtcNow.AddDays(-14)
            }
        };

        foreach (var item in sampleData)
        {
            _store.TryAdd(item.Id, item);
        }
    }

    public Task<IEnumerable<SteelBatch>> GetAllAsync(string? search = null, SteelGrade? grade = null, BatchStatus? status = null)
    {
        var query = _store.Values.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLowerInvariant();
            query = query.Where(b => b.HeatNumber.ToLowerInvariant().Contains(s) ||
                                     b.Location.ToLowerInvariant().Contains(s) ||
                                     b.Dimensions.ToLowerInvariant().Contains(s));
        }

        if (grade.HasValue)
        {
            query = query.Where(b => b.Grade == grade.Value);
        }

        if (status.HasValue)
        {
            query = query.Where(b => b.Status == status.Value);
        }

        return Task.FromResult<IEnumerable<SteelBatch>>(query.OrderByDescending(b => b.CreatedAt).ToList());
    }

    public Task<SteelBatch?> GetByIdAsync(Guid id)
    {
        _store.TryGetValue(id, out var batch);
        return Task.FromResult(batch);
    }

    public Task<SteelBatch> AddAsync(SteelBatch batch)
    {
        _store[batch.Id] = batch;
        return Task.FromResult(batch);
    }

    public Task<SteelBatch?> UpdateAsync(SteelBatch batch)
    {
        if (!_store.ContainsKey(batch.Id))
        {
            return Task.FromResult<SteelBatch?>(null);
        }

        _store[batch.Id] = batch;
        return Task.FromResult<SteelBatch?>(batch);
    }

    public Task<bool> DeleteAsync(Guid id)
    {
        return Task.FromResult(_store.TryRemove(id, out _));
    }

    public Task<Dictionary<BatchStatus, int>> GetStatusCountsAsync()
    {
        var counts = _store.Values
            .GroupBy(b => b.Status)
            .ToDictionary(g => g.Key, g => g.Count());

        return Task.FromResult(counts);
    }

    public Task<double> GetTotalTonnageAsync()
    {
        var total = _store.Values.Sum(b => b.WeightInTons);
        return Task.FromResult(total);
    }
}

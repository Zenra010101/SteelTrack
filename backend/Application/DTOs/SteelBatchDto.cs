using System;
using SteelTrack.Domain.Enums;

namespace SteelTrack.Application.DTOs;

public class SteelBatchDto
{
    public Guid Id { get; set; }
    public string HeatNumber { get; set; } = string.Empty;
    public string Grade { get; set; } = string.Empty;
    public double WeightInTons { get; set; }
    public string Dimensions { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? LastUpdated { get; set; }
}

public class CreateSteelBatchDto
{
    public string HeatNumber { get; set; } = string.Empty;
    public SteelGrade Grade { get; set; }
    public double WeightInTons { get; set; }
    public string Dimensions { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
}

public class UpdateBatchStatusDto
{
    public BatchStatus Status { get; set; }
    public string? NewLocation { get; set; }
}

public class InventoryStatsDto
{
    public int TotalBatches { get; set; }
    public double TotalTonnage { get; set; }
    public int InProductionCount { get; set; }
    public int QualityCheckCount { get; set; }
    public int AvailableCount { get; set; }
    public int ShippedCount { get; set; }
}

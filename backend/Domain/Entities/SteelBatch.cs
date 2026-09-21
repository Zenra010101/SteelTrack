using System;
using SteelTrack.Domain.Enums;

namespace SteelTrack.Domain.Entities;

public class SteelBatch
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string HeatNumber { get; set; } = string.Empty;
    public SteelGrade Grade { get; set; }
    public double WeightInTons { get; set; }
    public string Dimensions { get; set; } = string.Empty; // e.g. "10mm x 1200mm x 6000mm"
    public BatchStatus Status { get; set; } = BatchStatus.InProduction;
    public string Location { get; set; } = string.Empty; // e.g. "Yard B - Bay 4"
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastUpdated { get; set; }
}

using SteelTrack.Application.DTOs.Products;

namespace SteelTrack.Application.Interfaces;

public interface IBatchAllocationService
{
    Task<BatchAllocationResultDto> AllocateAsync(
        Guid productId,
        int quantity,
        Guid? preferredBatchId = null,
        CancellationToken cancellationToken = default);
}

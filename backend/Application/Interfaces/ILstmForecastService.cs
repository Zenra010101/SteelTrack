using SteelTrack.Application.DTOs.Products;

namespace SteelTrack.Application.Interfaces;

/// <summary>
/// Produces demand forecasts by delegating to the Python LSTM forecasting
/// service, falling back to the legacy seasonal estimate when that service
/// is unreachable.
/// </summary>
public interface ILstmForecastService
{
    Task<LstmForecastResponse> GetForecastAsync(
        DateTime fromMonth,
        DateTime toMonth,
        Guid? categoryId,
        Guid? branchId = null,
        CancellationToken cancellationToken = default);
}

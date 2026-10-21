using SteelTrack.Domain.Entities;
using SteelTrack.Domain.Enums;

namespace SteelTrack.Domain.Constants;

public static class GrsConstants
{
  public static bool CountsTowardSalesDeduction(GoodsReturnSlip g) =>
      g.Status == GrsStatus.Completed && !g.IsArchived;
}

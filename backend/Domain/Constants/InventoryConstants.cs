namespace SteelTrack.Domain.Constants;

public static class InventoryConstants
{
    public const int LowStockThreshold = 20;
    public const int CriticalStockThreshold = 9; // Stock < 10 is Very Low Stock
    public const int DefaultReorderLevel = 20;
}

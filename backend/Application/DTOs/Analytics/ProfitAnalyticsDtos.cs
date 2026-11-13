namespace SteelTrack.Application.DTOs.Analytics;

public class OwnerDashboardProfitDto
{
    public decimal TodayProfit { get; set; }
    public decimal TodaySalesProfit { get; set; }
    public decimal TodayReturnsProfitReversed { get; set; }
    public decimal TodayEvenExchangeProfit { get; set; }
    public int TodayZeroCostSaleLineCount { get; set; }
    public bool ProfitMissingCostWarning { get; set; }
    public decimal MonthSales { get; set; }
    public decimal MonthProfit { get; set; }
    public decimal TotalRevenue { get; set; }
    public decimal TotalProfit { get; set; }
    public decimal InventoryValue { get; set; }
    public List<DailyProfitPointDto> ProfitLast7Days { get; set; } = [];
}

public class DailyProfitPointDto
{
    public string Date { get; set; } = string.Empty;
    public decimal Sales { get; set; }
    public decimal Profit { get; set; }
}

public class ProfitByCategoryDto
{
    public string CategoryName { get; set; } = string.Empty;
    public int QuantitySold { get; set; }
    public decimal Revenue { get; set; }
    public decimal Cost { get; set; }
    public decimal Profit { get; set; }
}

public class ProfitMarginAnalyticsDto
{
    public decimal TotalRevenue { get; set; }
    public decimal TotalCogs { get; set; }
    public decimal GrossProfit { get; set; }
    public decimal GrossProfitMarginPct { get; set; }
    public decimal TotalOperatingExpenses { get; set; }
    public decimal NetProfit { get; set; }
    public decimal NetProfitMarginPct { get; set; }
    public List<ProductProfitMarginDto> ProductBreakdown { get; set; } = [];
    public List<BranchProfitMarginDto> BranchBreakdown { get; set; } = [];
    public List<TimeframeProfitPointDto> TimeframeBreakdown { get; set; } = [];
}

public class ProductProfitMarginDto
{
    public Guid ProductId { get; set; }
    public string ProductSku { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public decimal QuantitySold { get; set; }
    public decimal Revenue { get; set; }
    public decimal Cogs { get; set; }
    public decimal GrossProfit { get; set; }
    public decimal GrossProfitMarginPct { get; set; }
}

public class BranchProfitMarginDto
{
    public Guid? BranchId { get; set; }
    public string BranchName { get; set; } = string.Empty;
    public decimal Revenue { get; set; }
    public decimal Cogs { get; set; }
    public decimal GrossProfit { get; set; }
    public decimal GrossProfitMarginPct { get; set; }
    public decimal NetProfit { get; set; }
}

public class TimeframeProfitPointDto
{
    public string Period { get; set; } = string.Empty;
    public decimal Revenue { get; set; }
    public decimal Cogs { get; set; }
    public decimal GrossProfit { get; set; }
    public decimal NetProfit { get; set; }
}

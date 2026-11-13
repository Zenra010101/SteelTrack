using SteelTrack.Application.DTOs.Analytics;

using SteelTrack.Application.DTOs.Reports;

using SteelTrack.Application.Interfaces;

using SteelTrack.Domain.Constants;

using SteelTrack.Domain.Enums;

using SteelTrack.Infrastructure.Persistence;

using SteelTrack.Infrastructure.Services.Reports;

using Microsoft.EntityFrameworkCore;



namespace SteelTrack.Infrastructure.Services;



public class ProfitAnalyticsService : IProfitAnalyticsService

{

    private readonly AppDbContext _context;



    public ProfitAnalyticsService(AppDbContext context) => _context = context;



    public async Task<OwnerDashboardProfitDto> GetOwnerDashboardMetricsAsync(

        CancellationToken cancellationToken = default)

    {

        var today = DateTime.UtcNow.Date;

        var tomorrow = today.AddDays(1);

        var monthStart = new DateTime(today.Year, today.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        var chartFrom = today.AddDays(-6);

        var epoch = DateTime.SpecifyKind(DateTime.MinValue, DateTimeKind.Utc);



        var todayMetrics = await NetProfitQueryHelper.ComputeAsync(

            _context, today, tomorrow, includeArchived: false, saleUserId: null, returnsProcessedByUserId: null, cancellationToken);

        var monthMetrics = await NetProfitQueryHelper.ComputeAsync(

            _context, monthStart, tomorrow, includeArchived: false, saleUserId: null, returnsProcessedByUserId: null, cancellationToken);

        var allTimeMetrics = await NetProfitQueryHelper.ComputeAsync(

            _context, epoch, tomorrow, includeArchived: false, saleUserId: null, returnsProcessedByUserId: null, cancellationToken);



        var monthSales = await _context.Sales.AsNoTracking()

            .Where(s => s.Status == SaleStatus.Completed && !s.IsArchived && s.CreatedAt >= monthStart && s.CreatedAt < tomorrow)

            .SumAsync(s => (decimal?)s.TotalAmount, cancellationToken) ?? 0;



        var totalRevenue = await _context.Sales.AsNoTracking()

            .Where(s => s.Status == SaleStatus.Completed && !s.IsArchived)

            .SumAsync(s => (decimal?)s.TotalAmount, cancellationToken) ?? 0;



        var inventoryValue = await _context.Products.AsNoTracking()

            .Where(p => p.IsActive)

            .SumAsync(p => (decimal?)(p.CostPrice * p.StockQuantity), cancellationToken) ?? 0;



        var salesByDay = await _context.Sales.AsNoTracking()

            .Where(s => s.Status == SaleStatus.Completed && !s.IsArchived && s.CreatedAt >= chartFrom && s.CreatedAt < tomorrow)

            .GroupBy(s => s.CreatedAt.Date)

            .Select(g => new { Date = g.Key, Sales = g.Sum(s => s.TotalAmount) })

            .ToListAsync(cancellationToken);



        var profitByDay = await NetProfitQueryHelper.ComputeDailyAsync(

            _context, chartFrom, tomorrow, includeArchived: false, saleUserId: null, returnsProcessedByUserId: null, cancellationToken);



        var profitLast7 = Enumerable.Range(0, 7)

            .Select(i => today.AddDays(-i))

            .Reverse()

            .Select(d =>

            {

                var salesRow = salesByDay.FirstOrDefault(x => x.Date == d);

                profitByDay.TryGetValue(d, out var profitRow);

                return new DailyProfitPointDto

                {

                    Date = d.ToString("MMM dd"),

                    Sales = salesRow?.Sales ?? 0,

                    Profit = profitRow?.NetProfit ?? 0

                };

            })

            .ToList();



        return new OwnerDashboardProfitDto

        {

            TodayProfit = todayMetrics.NetProfit,

            TodaySalesProfit = todayMetrics.SalesProfit,

            TodayReturnsProfitReversed = todayMetrics.ReturnsProfitReversed,

            TodayEvenExchangeProfit = todayMetrics.EvenExchangeReplacementProfit,

            TodayZeroCostSaleLineCount = todayMetrics.ZeroCostSaleLineCount,

            ProfitMissingCostWarning = todayMetrics.ProfitMissingCostWarning,

            MonthSales = monthSales,

            MonthProfit = monthMetrics.NetProfit,

            TotalRevenue = totalRevenue,

            TotalProfit = allTimeMetrics.NetProfit,

            InventoryValue = inventoryValue,

            ProfitLast7Days = profitLast7

        };

    }



    public async Task<ProfitReportDto> BuildProfitReportAsync(

        DateTime from,

        DateTime toExclusive,

        Guid? cashierId,

        Guid? categoryId,

        Guid? productId,

        PaymentMethod? paymentMethod,

        Guid? customerId,

        bool includeArchived,

        Guid userId,

        string role,

        CancellationToken cancellationToken = default)

    {

        var saleQuery = _context.Sales.AsNoTracking()

            .Where(s => s.Status == SaleStatus.Completed

                && s.CreatedAt >= from

                && s.CreatedAt < toExclusive);



        if (!includeArchived)

            saleQuery = saleQuery.Where(s => !s.IsArchived);

        if (!RoleNames.IsOwner(role))

            saleQuery = saleQuery.Where(s => s.UserId == userId);

        else if (cashierId.HasValue)

            saleQuery = saleQuery.Where(s => s.UserId == cashierId.Value);

        if (paymentMethod.HasValue)

            saleQuery = saleQuery.Where(s => s.PaymentMethod == paymentMethod.Value);

        if (customerId.HasValue)

            saleQuery = saleQuery.Where(s => s.CustomerId == customerId.Value);



        if (categoryId.HasValue || productId.HasValue)

        {

            saleQuery = saleQuery.Where(s => s.Items.Any(i =>

                (!productId.HasValue || i.ProductId == productId.Value) &&

                (!categoryId.HasValue ||

                 _context.Products.Any(p => p.Id == i.ProductId && p.CategoryId == categoryId.Value))));

        }



        var grossSales = await saleQuery.SumAsync(s => (decimal?)s.TotalAmount, cancellationToken) ?? 0;



        var returnsQ = _context.GoodsReturnSlips.AsNoTracking()

            .Where(g => g.Status == GrsStatus.Completed && g.ReturnDate >= from && g.ReturnDate < toExclusive);

        if (!includeArchived)

            returnsQ = returnsQ.Where(g => !g.IsArchived);

        if (!RoleNames.IsOwner(role))

            returnsQ = returnsQ.Where(g => g.ProcessedByUserId == userId);

        else if (cashierId.HasValue)

            returnsQ = returnsQ.Where(g => g.ProcessedByUserId == cashierId.Value);



        var totalReturns = await returnsQ.SumAsync(g => (decimal?)g.TotalReturnAmount, cancellationToken) ?? 0;



        var saleIds = await saleQuery.Select(s => s.Id).ToListAsync(cancellationToken);

        var salesCogs = saleIds.Count == 0

            ? 0m

            : await _context.SaleItems.AsNoTracking()

                .Where(si => saleIds.Contains(si.SaleId))

                .SumAsync(si => (decimal?)(si.CostPriceAtSale * si.Quantity), cancellationToken) ?? 0;



        var returnIds = await returnsQ.Select(r => r.Id).ToListAsync(cancellationToken);

        var returnsCogs = returnIds.Count == 0

            ? 0m

            : await _context.GoodsReturnSlipItems.AsNoTracking()

                .Where(i => returnIds.Contains(i.GoodsReturnSlipId))

                .SumAsync(i => (decimal?)(i.CostPriceAtSale * i.Quantity), cancellationToken) ?? 0;



        var returnsProfit = returnIds.Count == 0

            ? 0m

            : await _context.GoodsReturnSlipItems.AsNoTracking()

                .Where(i => returnIds.Contains(i.GoodsReturnSlipId))

                .SumAsync(

                    i => (decimal?)(i.LineTotal - i.CostPriceAtSale * i.Quantity),

                    cancellationToken) ?? 0;



        var grossProfitFromSales = saleIds.Count == 0

            ? 0m

            : await saleQuery.SumAsync(s => (decimal?)s.GrossProfit, cancellationToken) ?? 0;



        Guid? filterSaleUser = !RoleNames.IsOwner(role) ? userId : cashierId;

        Guid? filterReturnsUser = !RoleNames.IsOwner(role) ? userId : cashierId;



        var periodMetrics = await NetProfitQueryHelper.ComputeAsync(

            _context,

            from,

            toExclusive,

            includeArchived,

            filterSaleUser,

            filterReturnsUser,

            cancellationToken);



        // When product/category filters apply, fall back to line-based sales profit only.

        var grossProfit = categoryId.HasValue || productId.HasValue

            ? grossProfitFromSales - returnsProfit

            : periodMetrics.NetProfit;



        var netSales = grossSales - totalReturns;

        var netCost = salesCogs - returnsCogs;

        var margin = netSales > 0 ? Math.Round(grossProfit / netSales * 100, 1) : 0;



        var dailyProfit = categoryId.HasValue || productId.HasValue

            ? await saleQuery

                .GroupBy(s => s.CreatedAt.Date)

                .Select(g => new ProfitByDayDto

                {

                    Date = g.Key.ToString("MMM dd"),

                    NetSales = g.Sum(s => s.TotalAmount),

                    Cost = 0,

                    Profit = g.Sum(s => s.GrossProfit)

                })

                .OrderBy(d => d.Date)

                .Take(366)

                .ToListAsync(cancellationToken)

            : await BuildNetProfitByDayAsync(from, toExclusive, includeArchived, filterSaleUser, filterReturnsUser, cancellationToken);



        var byProduct = saleIds.Count == 0

            ? []

            : await _context.SaleItems.AsNoTracking()

                .Where(si => saleIds.Contains(si.SaleId))

                .GroupBy(si => new { si.ProductName, si.ProductSku })

                .Select(g => new ProfitByProductDto

                {

                    ProductName = g.Key.ProductName,

                    Sku = g.Key.ProductSku,

                    QuantitySold = g.Sum(x => x.Quantity),

                    Revenue = g.Sum(x => x.LineTotal),

                    Cost = g.Sum(x => x.CostPriceAtSale * x.Quantity),

                    Profit = g.Sum(x => x.ProfitAmount)

                })

                .OrderByDescending(p => p.Profit)

                .Take(100)

                .ToListAsync(cancellationToken);



        var byCategory = saleIds.Count == 0

            ? []

            : await (

                from si in _context.SaleItems.AsNoTracking()

                where saleIds.Contains(si.SaleId)

                join p in _context.Products.AsNoTracking() on si.ProductId equals p.Id

                join c in _context.Categories.AsNoTracking() on p.CategoryId equals c.Id

                group si by c.Name

                into g

                select new ProfitByCategoryReportDto

                {

                    CategoryName = g.Key,

                    QuantitySold = g.Sum(x => x.Quantity),

                    Revenue = g.Sum(x => x.LineTotal),

                    Cost = g.Sum(x => x.CostPriceAtSale * x.Quantity),

                    Profit = g.Sum(x => x.ProfitAmount)

                })

                .OrderByDescending(c => c.Profit)

                .ToListAsync(cancellationToken);



        return new ProfitReportDto

        {

            From = from,

            To = toExclusive.AddDays(-1),

            GrossSales = grossSales,

            Returns = totalReturns,

            NetSales = netSales,

            CostOfGoodsSold = salesCogs,

            ReturnsCost = returnsCogs,

            NetCost = netCost,

            GrossProfit = grossProfit,

            ProfitMarginPercent = margin,

            ByDay = dailyProfit,

            ByProduct = byProduct,

            ByCategory = byCategory

        };

    }



    private async Task<List<ProfitByDayDto>> BuildNetProfitByDayAsync(

        DateTime from,

        DateTime toExclusive,

        bool includeArchived,

        Guid? saleUserId,

        Guid? returnsProcessedByUserId,

        CancellationToken cancellationToken)

    {

        var salesByDay = await _context.Sales.AsNoTracking()

            .Where(s => s.Status == SaleStatus.Completed

                && s.CreatedAt >= from

                && s.CreatedAt < toExclusive

                && (includeArchived || !s.IsArchived))

            .Where(s => !saleUserId.HasValue || s.UserId == saleUserId.Value)

            .GroupBy(s => s.CreatedAt.Date)

            .Select(g => new { Date = g.Key, NetSales = g.Sum(s => s.TotalAmount) })

            .ToListAsync(cancellationToken);



        var returnsByDay = await _context.GoodsReturnSlips.AsNoTracking()

            .Where(g => g.Status == GrsStatus.Completed

                && g.ReturnDate >= from

                && g.ReturnDate < toExclusive

                && (includeArchived || !g.IsArchived))

            .Where(g => !returnsProcessedByUserId.HasValue || g.ProcessedByUserId == returnsProcessedByUserId.Value)

            .GroupBy(g => g.ReturnDate.Date)

            .Select(g => new { Date = g.Key, Amount = g.Sum(x => x.TotalReturnAmount) })

            .ToListAsync(cancellationToken);



        var profitByDay = await NetProfitQueryHelper.ComputeDailyAsync(

            _context, from, toExclusive, includeArchived, saleUserId, returnsProcessedByUserId, cancellationToken);



        return salesByDay

            .Select(s =>

            {

                var returns = returnsByDay.FirstOrDefault(r => r.Date == s.Date)?.Amount ?? 0;

                profitByDay.TryGetValue(s.Date, out var profit);

                return new ProfitByDayDto

                {

                    Date = s.Date.ToString("MMM dd"),

                    NetSales = s.NetSales - returns,

                    Cost = 0,

                    Profit = profit?.NetProfit ?? 0

                };

            })

            .OrderBy(d => d.Date)

            .Take(366)

            .ToList();

    }

    public async Task<ProfitMarginAnalyticsDto> GetProfitMarginAnalyticsAsync(
        DateTime? from,
        DateTime? to,
        Guid? branchId,
        Guid? productId,
        CancellationToken cancellationToken = default)
    {
        var startDate = from ?? DateTime.UtcNow.AddMonths(-1);
        var endDate = to ?? DateTime.UtcNow;

        var salesQuery = _context.Sales.AsNoTracking()
            .Include(s => s.Items)
            .Include(s => s.Branch)
            .Where(s => s.Status == SaleStatus.Completed && !s.IsArchived && s.CreatedAt >= startDate && s.CreatedAt <= endDate);

        if (branchId.HasValue)
        {
            salesQuery = salesQuery.Where(s => s.BranchId == branchId.Value);
        }

        var sales = await salesQuery.ToListAsync(cancellationToken);

        var allItems = sales.SelectMany(s => s.Items.Select(item => new { Sale = s, Item = item }))
            .Where(x => !productId.HasValue || x.Item.ProductId == productId.Value)
            .ToList();

        decimal totalRevenue = allItems.Sum(x => x.Item.LineTotal);
        decimal totalCogs = allItems.Sum(x => x.Item.CostPriceAtSale * x.Item.Quantity);
        decimal grossProfit = totalRevenue - totalCogs;
        decimal grossProfitMarginPct = totalRevenue > 0 ? Math.Round((grossProfit / totalRevenue) * 100m, 2) : 0;

        var expenseQuery = _context.ExpenseVouchers.AsNoTracking()
            .Where(e => e.Status == ExpenseVoucherStatus.Paid && e.ExpenseDate >= DateOnly.FromDateTime(startDate) && e.ExpenseDate <= DateOnly.FromDateTime(endDate));

        var totalOperatingExpenses = await expenseQuery.SumAsync(e => (decimal?)e.Amount, cancellationToken) ?? 0;
        decimal netProfit = grossProfit - totalOperatingExpenses;
        decimal netProfitMarginPct = totalRevenue > 0 ? Math.Round((netProfit / totalRevenue) * 100m, 2) : 0;

        var productGroups = allItems
            .GroupBy(x => new { x.Item.ProductId, x.Item.ProductSku, x.Item.ProductName })
            .Select(g =>
            {
                var rev = g.Sum(x => x.Item.LineTotal);
                var cogs = g.Sum(x => x.Item.CostPriceAtSale * x.Item.Quantity);
                var gp = rev - cogs;
                var margin = rev > 0 ? Math.Round((gp / rev) * 100m, 2) : 0;
                return new ProductProfitMarginDto
                {
                    ProductId = g.Key.ProductId,
                    ProductSku = g.Key.ProductSku,
                    ProductName = g.Key.ProductName,
                    QuantitySold = g.Sum(x => x.Item.Quantity),
                    Revenue = rev,
                    Cogs = cogs,
                    GrossProfit = gp,
                    GrossProfitMarginPct = margin
                };
            })
            .OrderByDescending(p => p.Revenue)
            .ToList();

        var branchGroups = sales
            .GroupBy(s => new { s.BranchId, BranchName = s.Branch?.Name ?? "Unassigned" })
            .Select(g =>
            {
                var items = g.SelectMany(s => s.Items).Where(i => !productId.HasValue || i.ProductId == productId.Value).ToList();
                var rev = items.Sum(i => i.LineTotal);
                var cogs = items.Sum(i => i.CostPriceAtSale * i.Quantity);
                var gp = rev - cogs;
                var margin = rev > 0 ? Math.Round((gp / rev) * 100m, 2) : 0;
                return new BranchProfitMarginDto
                {
                    BranchId = g.Key.BranchId,
                    BranchName = g.Key.BranchName,
                    Revenue = rev,
                    Cogs = cogs,
                    GrossProfit = gp,
                    GrossProfitMarginPct = margin,
                    NetProfit = gp
                };
            })
            .OrderByDescending(b => b.Revenue)
            .ToList();

        var isDaily = (endDate - startDate).TotalDays <= 31;
        var timeframePoints = allItems
            .GroupBy(x => isDaily ? x.Sale.CreatedAt.ToString("yyyy-MM-dd") : x.Sale.CreatedAt.ToString("yyyy-MM"))
            .OrderBy(g => g.Key)
            .Select(g =>
            {
                var rev = g.Sum(x => x.Item.LineTotal);
                var cogs = g.Sum(x => x.Item.CostPriceAtSale * x.Item.Quantity);
                var gp = rev - cogs;
                return new TimeframeProfitPointDto
                {
                    Period = g.Key,
                    Revenue = rev,
                    Cogs = cogs,
                    GrossProfit = gp,
                    NetProfit = gp
                };
            })
            .ToList();

        return new ProfitMarginAnalyticsDto
        {
            TotalRevenue = totalRevenue,
            TotalCogs = totalCogs,
            GrossProfit = grossProfit,
            GrossProfitMarginPct = grossProfitMarginPct,
            TotalOperatingExpenses = totalOperatingExpenses,
            NetProfit = netProfit,
            NetProfitMarginPct = netProfitMarginPct,
            ProductBreakdown = productGroups,
            BranchBreakdown = branchGroups,
            TimeframeBreakdown = timeframePoints
        };
    }
}



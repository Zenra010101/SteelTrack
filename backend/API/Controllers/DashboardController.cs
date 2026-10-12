using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SteelTrack.Infrastructure.Persistence;

namespace SteelTrack.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DashboardController : ControllerBase
{
    private readonly SteelTrackDbContext? _dbContext;

    public DashboardController(SteelTrackDbContext? dbContext = null)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSummary()
    {
        if (_dbContext == null)
        {
            return Ok(new
            {
                todaySales = 0m,
                todayTransactions = 0,
                monthSales = 0m,
                totalProducts = 0,
                lowStockCount = 0,
                outstandingReceivables = 0m,
                pendingPdcAmount = 0m,
                recentSales = new List<object>()
            });
        }

        var today = DateTime.UtcNow.Date;
        var firstOfMonth = new DateTime(today.Year, today.Month, 1);

        // Sales today
        var todaySalesList = await _dbContext.Sales
            .AsNoTracking()
            .Where(s => s.CreatedAt >= today && s.Status != 2)
            .Select(s => s.TotalAmount)
            .ToListAsync();
        var todaySales = todaySalesList.Sum();
        var todayTransactions = todaySalesList.Count;

        // Sales month-to-date
        var monthSales = await _dbContext.Sales
            .AsNoTracking()
            .Where(s => s.CreatedAt >= firstOfMonth && s.Status != 2)
            .SumAsync(s => s.TotalAmount);

        // Inventory metrics
        var totalProducts = await _dbContext.Products.CountAsync();
        var lowStockCount = await _dbContext.Products
            .CountAsync(p => p.StockQuantity <= p.ReorderLevel);

        var totalInventoryValuation = await _dbContext.Products
            .SumAsync(p => p.StockQuantity * p.CostPrice);

        // Receivables
        var outstandingReceivables = await _dbContext.CustomerReceivables
            .Where(r => r.RemainingBalance > 0 && !r.IsArchived)
            .SumAsync(r => r.RemainingBalance);

        // Pending PDC Cheques
        var pendingPdcCheques = await _dbContext.SaleCheques
            .Where(c => c.Status == 0) // Pending
            .ToListAsync();
        var pendingPdcAmount = pendingPdcCheques.Sum(c => c.Amount);
        var pendingPdcCount = pendingPdcCheques.Count;

        // Recent 5 sales
        var recentSales = await _dbContext.Sales
            .AsNoTracking()
            .OrderByDescending(s => s.CreatedAt)
            .Take(5)
            .Select(s => new
            {
                s.Id,
                s.SaleNumber,
                s.CustomerName,
                s.TotalAmount,
                PaymentMethod = s.PaymentMethod.ToString(),
                s.Status,
                s.CreatedAt
            })
            .ToListAsync();

        return Ok(new
        {
            todaySales,
            todayTransactions,
            monthSales,
            totalProducts,
            lowStockCount,
            totalInventoryValuation,
            outstandingReceivables,
            pendingPdcAmount,
            pendingPdcCount,
            recentSales
        });
    }
}

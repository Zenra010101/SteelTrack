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
public class AlertsController : ControllerBase
{
    private readonly SteelTrackDbContext? _dbContext;

    public AlertsController(SteelTrackDbContext? dbContext = null)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAlerts()
    {
        if (_dbContext == null)
        {
            return Ok(new
            {
                lowStockCount = 0,
                overdueChequesCount = 0,
                overdueReceivablesCount = 0,
                pendingReceivingCount = 0,
                pendingAdjustmentsCount = 0,
                alerts = new List<object>()
            });
        }

        var now = DateTime.UtcNow;

        // 1. Low stock products
        var lowStockProducts = await _dbContext.Products
            .AsNoTracking()
            .Where(p => p.StockQuantity <= p.ReorderLevel)
            .OrderBy(p => p.StockQuantity)
            .Take(10)
            .Select(p => new
            {
                Type = "LowStock",
                Severity = p.StockQuantity == 0 ? "Critical" : "Warning",
                Message = $"Low stock: {p.Name} ({p.StockQuantity} left, reorder level {p.ReorderLevel})",
                EntityId = p.Id,
                Timestamp = p.UpdatedAt ?? p.CreatedAt
            })
            .ToListAsync();

        var lowStockTotalCount = await _dbContext.Products
            .CountAsync(p => p.StockQuantity <= p.ReorderLevel);

        // 2. Overdue or upcoming PDC cheques (matured or within 7 days)
        var sevenDaysAhead = now.AddDays(7);
        var alertCheques = await _dbContext.SaleCheques
            .AsNoTracking()
            .Where(c => c.Status == 0 && c.MaturityDate <= sevenDaysAhead)
            .OrderBy(c => c.MaturityDate)
            .Take(10)
            .Select(c => new
            {
                Type = "ChequeMaturity",
                Severity = c.MaturityDate <= now ? "Critical" : "Info",
                Message = c.MaturityDate <= now
                    ? $"Cheque #{c.ChequeNumber} ({c.BankName}) of ₱{c.Amount:N2} was due on {c.MaturityDate:yyyy-MM-dd}!"
                    : $"Cheque #{c.ChequeNumber} ({c.BankName}) of ₱{c.Amount:N2} matures on {c.MaturityDate:yyyy-MM-dd}",
                EntityId = c.Id,
                Timestamp = c.MaturityDate
            })
            .ToListAsync();

        var overdueChequesCount = await _dbContext.SaleCheques
            .CountAsync(c => c.Status == 0 && c.MaturityDate <= now);

        // 3. Overdue receivables
        var overdueReceivables = await _dbContext.CustomerReceivables
            .AsNoTracking()
            .Where(r => r.RemainingBalance > 0 && r.DueDate <= now && !r.IsArchived)
            .OrderBy(r => r.DueDate)
            .Take(10)
            .Select(r => new
            {
                Type = "OverdueReceivable",
                Severity = "Warning",
                Message = $"Receivable for {r.CustomerName} (₱{r.RemainingBalance:N2}) is past due date ({r.DueDate:yyyy-MM-dd})",
                EntityId = r.Id,
                Timestamp = r.DueDate
            })
            .ToListAsync();

        var overdueReceivablesCount = await _dbContext.CustomerReceivables
            .CountAsync(r => r.RemainingBalance > 0 && r.DueDate <= now && !r.IsArchived);

        // 4. Pending approvals
        var pendingReceivingCount = await _dbContext.StockReceivings
            .CountAsync(r => (int)r.Status == 1);

        var pendingAdjustmentsCount = await _dbContext.InventoryAdjustmentRequests
            .CountAsync(a => a.Status == 0);

        var allAlerts = new List<object>();
        allAlerts.AddRange(lowStockProducts);
        allAlerts.AddRange(alertCheques);
        allAlerts.AddRange(overdueReceivables);

        return Ok(new
        {
            lowStockCount = lowStockTotalCount,
            overdueChequesCount,
            overdueReceivablesCount,
            pendingReceivingCount,
            pendingAdjustmentsCount,
            alerts = allAlerts
        });
    }

    [HttpGet("summary")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSummary()
    {
        return await GetAlerts();
    }
}

using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SteelTrack.Domain.Entities;
using SteelTrack.Infrastructure.Persistence;

namespace SteelTrack.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReportsController : ControllerBase
{
    private readonly SteelTrackDbContext? _dbContext;

    public ReportsController(SteelTrackDbContext? dbContext = null)
    {
        _dbContext = dbContext;
    }

    [HttpGet("sales-summary")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSalesSummary(
        [FromQuery] string preset = "today",
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null)
    {
        if (_dbContext == null)
        {
            return Ok(new
            {
                preset,
                from = DateTime.UtcNow.Date,
                to = DateTime.UtcNow,
                totalTransactions = 0,
                grossSales = 0m,
                discounts = 0m,
                taxAmount = 0m,
                netSales = 0m
            });
        }

        var now = DateTime.UtcNow;
        DateTime startDate = from ?? now.Date;
        DateTime endDate = to ?? now;

        if (!from.HasValue && !to.HasValue)
        {
            switch (preset.ToLower())
            {
                case "today":
                    startDate = now.Date;
                    endDate = now;
                    break;
                case "this_week":
                    startDate = now.Date.AddDays(-(int)now.DayOfWeek);
                    endDate = now;
                    break;
                case "this_month":
                    startDate = new DateTime(now.Year, now.Month, 1);
                    endDate = now;
                    break;
                case "this_year":
                    startDate = new DateTime(now.Year, 1, 1);
                    endDate = now;
                    break;
            }
        }

        var sales = await _dbContext.Sales
            .AsNoTracking()
            .Where(s => s.Status != 2 && s.CreatedAt >= startDate && s.CreatedAt <= endDate)
            .ToListAsync();

        var totalTransactions = sales.Count;
        var grossSales = sales.Sum(s => s.SubTotal);
        var discounts = sales.Sum(s => s.DiscountAmount);
        var taxAmount = sales.Sum(s => s.TaxAmount);
        var netSales = sales.Sum(s => s.TotalAmount);

        // Group by payment method
        var byPaymentMethod = sales
            .GroupBy(s => s.PaymentMethod.ToString())
            .Select(g => new
            {
                Method = g.Key,
                Count = g.Count(),
                TotalAmount = g.Sum(s => s.TotalAmount)
            })
            .ToList();

        return Ok(new
        {
            preset,
            from = startDate,
            to = endDate,
            totalTransactions,
            grossSales,
            discounts,
            taxAmount,
            netSales,
            byPaymentMethod
        });
    }

    [HttpGet("top-products")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTopProducts([FromQuery] int count = 10)
    {
        if (_dbContext == null) return Ok(new List<object>());

        var top = await _dbContext.SaleItems
            .AsNoTracking()
            .GroupBy(i => new { i.ProductId, i.ProductName })
            .Select(g => new
            {
                ProductId = g.Key.ProductId,
                ProductName = g.Key.ProductName,
                TotalQuantitySold = g.Sum(i => i.Quantity),
                TotalRevenue = g.Sum(i => i.LineTotal)
            })
            .OrderByDescending(t => t.TotalRevenue)
            .Take(Math.Min(50, Math.Max(1, count)))
            .ToListAsync();

        return Ok(top);
    }

    [HttpPost("verify")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateVerification([FromBody] CreateVerificationDto dto)
    {
        if (_dbContext == null) return StatusCode(503, "Database unavailable.");

        var rawString = $"{dto.FromDate:yyyy-MM-dd}_{dto.ToDate:yyyy-MM-dd}_{dto.GrossSales}_{Guid.NewGuid():N}";
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawString))).Substring(0, 16).ToUpper();
        var reportCode = $"ST-REP-{hash}";

        var verification = new SalesReportVerification
        {
            Id = Guid.NewGuid().ToString(),
            ReportCode = reportCode,
            Preset = dto.Preset ?? "custom",
            PeriodLabel = dto.PeriodLabel ?? $"{dto.FromDate:yyyy-MM-dd} to {dto.ToDate:yyyy-MM-dd}",
            FromDate = dto.FromDate,
            ToDate = dto.ToDate,
            GrossSales = dto.GrossSales,
            NetSales = dto.NetSales,
            TotalLineAmount = dto.TotalLineAmount,
            PrintedAtLabel = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss 'UTC'"),
            PrintedAtUtc = DateTime.UtcNow,
            StoreName = dto.StoreName ?? "SteelTrack Enterprise",
            GeneratedByUserId = dto.GeneratedByUserId,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.SalesReportVerifications.Add(verification);
        await _dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(VerifyReport), new { code = reportCode }, verification);
    }

    [HttpGet("verify/{code}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> VerifyReport(string code)
    {
        if (_dbContext == null) return NotFound();

        var normalized = code.Trim().TrimStart('/');
        var result = await _dbContext.SalesReportVerifications
            .AsNoTracking()
            .FirstOrDefaultAsync(v => v.ReportCode.ToLower() == normalized.ToLower());

        if (result == null)
            return NotFound(new { message = $"Sales report verification code '{code}' not found or invalid." });

        return Ok(result);
    }
}

public class CreateVerificationDto
{
    public string? Preset { get; set; }
    public string? PeriodLabel { get; set; }
    public DateTime FromDate { get; set; }
    public DateTime ToDate { get; set; }
    public decimal GrossSales { get; set; }
    public decimal NetSales { get; set; }
    public decimal TotalLineAmount { get; set; }
    public string? StoreName { get; set; }
    public string? GeneratedByUserId { get; set; }
}

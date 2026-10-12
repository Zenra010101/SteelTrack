using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SteelTrack.Domain.Entities;
using SteelTrack.Infrastructure.Persistence;

namespace SteelTrack.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SettingsController : ControllerBase
{
    private readonly SteelTrackDbContext? _dbContext;

    public SettingsController(SteelTrackDbContext? dbContext = null)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSettings()
    {
        if (_dbContext == null)
        {
            return Ok(new StoreSetting
            {
                Id = 1,
                StoreName = "SteelTrack Mindanao",
                Tagline = "Industrial Steel & Fabrication Supplies",
                Address = "General Santos City & Davao City, Philippines",
                Phone = "(083) 552-8800",
                VatEnabled = true,
                VatRate = 12.0m,
                PricesIncludeVat = true,
                CashReceiptTitle = "OFFICIAL RECEIPT",
                TrustReceiptTitle = "COLLECTION RECEIPT / TR"
            });
        }

        var settings = await _dbContext.StoreSettings.FirstOrDefaultAsync(s => s.Id == 1);
        if (settings == null)
        {
            settings = new StoreSetting
            {
                Id = 1,
                StoreName = "SteelTrack Mindanao",
                Tagline = "Industrial Steel & Fabrication Supplies",
                Address = "General Santos City & Davao City, Philippines",
                Phone = "(083) 552-8800",
                VatEnabled = true,
                VatRate = 12.0m,
                PricesIncludeVat = true,
                CashReceiptTitle = "OFFICIAL RECEIPT",
                TrustReceiptTitle = "COLLECTION RECEIPT / TR"
            };
            _dbContext.StoreSettings.Add(settings);
            await _dbContext.SaveChangesAsync();
        }

        return Ok(settings);
    }

    [HttpPut]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateSettings([FromBody] UpdateSettingsDto dto)
    {
        if (_dbContext == null) return StatusCode(503, "Database unavailable.");

        var settings = await _dbContext.StoreSettings.FirstOrDefaultAsync(s => s.Id == 1);
        if (settings == null)
        {
            settings = new StoreSetting { Id = 1 };
            _dbContext.StoreSettings.Add(settings);
        }

        if (dto.StoreName != null) settings.StoreName = dto.StoreName;
        if (dto.Tagline != null) settings.Tagline = dto.Tagline;
        if (dto.Address != null) settings.Address = dto.Address;
        if (dto.Phone != null) settings.Phone = dto.Phone;
        if (dto.BrandLine != null) settings.BrandLine = dto.BrandLine;
        if (dto.OutletLine != null) settings.OutletLine = dto.OutletLine;
        if (dto.VatEnabled.HasValue) settings.VatEnabled = dto.VatEnabled.Value;
        if (dto.VatRate.HasValue) settings.VatRate = dto.VatRate.Value;
        if (dto.PricesIncludeVat.HasValue) settings.PricesIncludeVat = dto.PricesIncludeVat.Value;
        if (dto.CashReceiptTitle != null) settings.CashReceiptTitle = dto.CashReceiptTitle;
        if (dto.TrustReceiptTitle != null) settings.TrustReceiptTitle = dto.TrustReceiptTitle;
        if (dto.AllowCashierBarcodePrinting.HasValue) settings.AllowCashierBarcodePrinting = dto.AllowCashierBarcodePrinting.Value;

        await _dbContext.SaveChangesAsync();
        return Ok(settings);
    }
}

public class UpdateSettingsDto
{
    public string? StoreName { get; set; }
    public string? Tagline { get; set; }
    public string? Address { get; set; }
    public string? Phone { get; set; }
    public string? BrandLine { get; set; }
    public string? OutletLine { get; set; }
    public bool? VatEnabled { get; set; }
    public decimal? VatRate { get; set; }
    public bool? PricesIncludeVat { get; set; }
    public string? CashReceiptTitle { get; set; }
    public string? TrustReceiptTitle { get; set; }
    public bool? AllowCashierBarcodePrinting { get; set; }
}

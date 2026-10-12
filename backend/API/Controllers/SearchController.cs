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
public class SearchController : ControllerBase
{
    private readonly SteelTrackDbContext? _dbContext;

    public SearchController(SteelTrackDbContext? dbContext = null)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Search([FromQuery] string? q)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2 || _dbContext == null)
        {
            return Ok(new
            {
                query = q ?? string.Empty,
                products = new List<object>(),
                customers = new List<object>(),
                suppliers = new List<object>(),
                sales = new List<object>()
            });
        }

        var term = q.Trim().ToLower();

        // 1. Search Products
        var products = await _dbContext.Products
            .AsNoTracking()
            .Where(p =>
                p.Name.ToLower().Contains(term) ||
                p.Sku.ToLower().Contains(term) ||
                (p.Barcode != null && p.Barcode.ToLower().Contains(term)) ||
                (p.Grade != null && p.Grade.ToLower().Contains(term)))
            .Take(10)
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.Sku,
                p.Barcode,
                SellingPrice = p.UnitPrice,
                p.UnitPrice,
                p.StockQuantity,
                Unit = p.UnitOfMeasure
            })
            .ToListAsync();

        // 2. Search Customers
        var customers = await _dbContext.Customers
            .AsNoTracking()
            .Where(c =>
                c.Name.ToLower().Contains(term) ||
                (c.CustomerCode != null && c.CustomerCode.ToLower().Contains(term)) ||
                (c.Phone != null && c.Phone.ToLower().Contains(term)) ||
                (c.Email != null && c.Email.ToLower().Contains(term)))
            .Take(10)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.CustomerCode,
                c.Phone,
                c.Email,
                c.CreditLimit
            })
            .ToListAsync();

        // 3. Search Suppliers
        var suppliers = await _dbContext.Suppliers
            .AsNoTracking()
            .Where(s =>
                s.Name.ToLower().Contains(term) ||
                (s.ContactPerson != null && s.ContactPerson.ToLower().Contains(term)) ||
                (s.Email != null && s.Email.ToLower().Contains(term)) ||
                (s.Phone != null && s.Phone.ToLower().Contains(term)))
            .Take(10)
            .Select(s => new
            {
                s.Id,
                s.Name,
                s.ContactPerson,
                s.Phone,
                s.Email
            })
            .ToListAsync();

        // 4. Search Sales
        var sales = await _dbContext.Sales
            .AsNoTracking()
            .Where(s =>
                s.SaleNumber.ToLower().Contains(term) ||
                (s.CustomerName != null && s.CustomerName.ToLower().Contains(term)))
            .Take(10)
            .Select(s => new
            {
                s.Id,
                s.SaleNumber,
                s.CustomerName,
                s.TotalAmount,
                s.CreatedAt
            })
            .ToListAsync();

        return Ok(new
        {
            query = q,
            products,
            customers,
            suppliers,
            sales
        });
    }
}

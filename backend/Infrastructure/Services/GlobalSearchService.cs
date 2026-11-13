using SteelTrack.Application.DTOs.Search;
using SteelTrack.Application.Interfaces;
using SteelTrack.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace SteelTrack.Infrastructure.Services;

public class GlobalSearchService : IGlobalSearchService
{
    private readonly AppDbContext _context;

    public GlobalSearchService(AppDbContext context) => _context = context;

    public async Task<GlobalSearchResultDto> SearchAsync(string query, CancellationToken cancellationToken = default)
    {
        var term = query.Trim().ToLower();
        if (term.Length < 2)
            return new GlobalSearchResultDto();

        var products = await _context.Products
            .Where(p => p.IsActive && (
                p.Name.ToLower().Contains(term) ||
                p.Sku.ToLower().Contains(term) ||
                (p.Barcode != null && p.Barcode.ToLower().Contains(term))))
            .OrderBy(p => p.Name)
            .Take(8)
            .Select(p => new { p.Id, p.Name, p.Sku })
            .ToListAsync(cancellationToken);

        var customers = await _context.Customers
            .Where(c => c.IsActive && (
                c.Name.ToLower().Contains(term) ||
                (c.Phone != null && c.Phone.Contains(term))))
            .OrderBy(c => c.Name)
            .Take(6)
            .Select(c => new { c.Id, c.Name, c.Phone })
            .ToListAsync(cancellationToken);

        var suppliers = await _context.Suppliers
            .Where(s => s.Status != Domain.Enums.SupplierStatus.Archived && (
                s.Name.ToLower().Contains(term) ||
                (s.ContactPerson != null && s.ContactPerson.ToLower().Contains(term))))
            .OrderBy(s => s.Name)
            .Take(6)
            .Select(s => new { s.Id, s.Name })
            .ToListAsync(cancellationToken);

        var batches = await _context.ProductBatches
            .Include(b => b.Product)
            .Include(b => b.Branch)
            .Where(b => b.IsActive && b.BatchCode != null && (
                b.BatchCode.ToLower().Contains(term) ||
                b.Product.Name.ToLower().Contains(term) ||
                b.Product.Sku.ToLower().Contains(term)))
            .OrderByDescending(b => b.CreatedAt)
            .Take(6)
            .Select(b => new { b.Id, BatchCode = b.BatchCode ?? "", ProductName = b.Product.Name, BranchName = b.Branch != null ? b.Branch.Name : "Main", b.Quantity })
            .ToListAsync(cancellationToken);

        var invoices = await _context.Sales
            .Where(s => !s.IsArchived && (
                s.SaleNumber.ToLower().Contains(term) ||
                (s.CustomerName != null && s.CustomerName.ToLower().Contains(term))))
            .OrderByDescending(s => s.CreatedAt)
            .Take(6)
            .Select(s => new { s.Id, s.SaleNumber, s.CustomerName, s.TotalAmount, s.CreatedAt })
            .ToListAsync(cancellationToken);

        var transfers = await _context.StockTransfers
            .Where(t =>
                t.TransferNumber.ToLower().Contains(term) ||
                t.HeatNumber.ToLower().Contains(term) ||
                t.SourceBranch.ToLower().Contains(term) ||
                t.DestinationBranch.ToLower().Contains(term))
            .OrderByDescending(t => t.RequestedAt)
            .Take(6)
            .Select(t => new { t.Id, t.TransferNumber, t.SourceBranch, t.DestinationBranch, t.WeightInTons, t.Status })
            .ToListAsync(cancellationToken);

        return new GlobalSearchResultDto
        {
            Products = products.Select(p => new GlobalSearchHitDto
            {
                Id = p.Id.ToString(),
                Label = p.Name,
                Subtitle = p.Sku,
                Route = $"/products?search={Uri.EscapeDataString(query.Trim())}"
            }).ToList(),
            Customers = customers.Select(c => new GlobalSearchHitDto
            {
                Id = c.Id.ToString(),
                Label = c.Name,
                Subtitle = c.Phone,
                Route = $"/customers?id={c.Id}"
            }).ToList(),
            Suppliers = suppliers.Select(s => new GlobalSearchHitDto
            {
                Id = s.Id.ToString(),
                Label = s.Name,
                Route = $"/suppliers?id={s.Id}"
            }).ToList(),
            Batches = batches.Select(b => new GlobalSearchHitDto
            {
                Id = b.Id.ToString(),
                Label = b.BatchCode,
                Subtitle = $"{b.ProductName} • {b.BranchName} ({b.Quantity} units)",
                Route = $"/inventory?search={Uri.EscapeDataString(b.BatchCode)}"
            }).ToList(),
            Invoices = invoices.Select(s => new GlobalSearchHitDto
            {
                Id = s.Id.ToString(),
                Label = s.SaleNumber,
                Subtitle = $"{s.CustomerName ?? "Walk-in"} • ₱{s.TotalAmount:N2} • {s.CreatedAt:yyyy-MM-dd}",
                Route = $"/sales?search={Uri.EscapeDataString(s.SaleNumber)}"
            }).ToList(),
            Transfers = transfers.Select(t => new GlobalSearchHitDto
            {
                Id = t.Id,
                Label = t.TransferNumber,
                Subtitle = $"{t.SourceBranch} → {t.DestinationBranch} ({t.WeightInTons}t) • {t.Status}",
                Route = $"/transfers?search={Uri.EscapeDataString(t.TransferNumber)}"
            }).ToList()
        };
    }
}

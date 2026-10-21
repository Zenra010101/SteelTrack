using System;
using System.Collections.Generic;
using SteelTrack.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace SteelTrack.Infrastructure.Persistence;

/// <summary>Assigns GSP barcodes to active products that have none (safe to re-run).</summary>
public static class ProductBarcodeBackfillMigrator
{
    public static async Task ApplyAsync(AppDbContext context, ILogger? logger = null)
    {
        try
        {
            var existingCodes = await context.Products
                .AsNoTracking()
                .Where(p => p.Barcode != null && p.Barcode != "")
                .Select(p => p.Barcode!)
                .ToListAsync();

            var taken = new HashSet<string>(existingCodes, StringComparer.OrdinalIgnoreCase);

            var missing = await context.Products
                .Where(p => p.IsActive && (p.Barcode == null || p.Barcode == ""))
                .ToListAsync();

            if (missing.Count == 0)
                return;

            foreach (var product in missing)
            {
                var barcode = ProductBarcodeGenerator.GenerateUnique(product.Sku, taken.Contains);
                product.Barcode = barcode;
                product.UpdatedAt = DateTime.UtcNow;
                taken.Add(barcode);
            }

            await context.SaveChangesAsync();
            logger?.LogInformation(
                "Product barcode backfill: assigned barcodes to {Count} active product(s).",
                missing.Count);
        }
        catch (Exception ex)
        {
            logger?.LogWarning(ex, "ProductBarcodeBackfillMigrator skipped due to schema differences: {Message}", ex.Message);
        }
    }
}

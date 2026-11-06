using System;
using SteelTrack.Infrastructure.Services;
using SteelTrack.Domain.Entities;
using SteelTrack.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace SteelTrack.Infrastructure.Persistence;

/// <summary>One-time migration: existing product stock → LEGACY batch rows.</summary>
public static class ProductBatchLegacyMigrator
{
    public static async Task ApplyAsync(AppDbContext context, ILogger? logger = null)
    {
        try
        {
            var productsNeedingBatch = await context.Products
                .Where(p => p.StockQuantity > 0)
                .Where(p => !context.ProductBatches.Any(b => b.ProductId == p.Id))
                .ToListAsync();

            if (productsNeedingBatch.Count == 0)
                return;

            var defaultBranchId = await context.Branches.Where(b => b.IsActive).Select(b => (Guid?)b.Id).FirstOrDefaultAsync()
                ?? await context.Branches.Select(b => (Guid?)b.Id).FirstOrDefaultAsync();

            foreach (var product in productsNeedingBatch)
            {
                context.ProductBatches.Add(ProductBatchStockHelper.CreateLegacyBatch(product, defaultBranchId));
            }

            await context.SaveChangesAsync();
            logger?.LogInformation(
                "Product batch legacy migration: created {Count} LEGACY batch(es) for existing stock.",
                productsNeedingBatch.Count);
        }
        catch (Exception ex)
        {
            logger?.LogWarning(ex, "ProductBatchLegacyMigrator skipped due to schema differences: {Message}", ex.Message);
        }
    }
}

using System.Security.Claims;
using SteelTrack.Domain.Constants;
using SteelTrack.Domain.Entities;
using SteelTrack.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace SteelTrack.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class BranchProductsController : ControllerBase
{
    private readonly AppDbContext _context;

    public BranchProductsController(AppDbContext context)
    {
        _context = context;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private string UserRoleName => User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
    private bool IsOwnerOrAdmin => RoleNames.IsOwner(UserRoleName);

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? branch = null,
        [FromQuery] Guid? branchId = null,
        [FromQuery] string? search = null,
        [FromQuery] Guid? categoryId = null,
        [FromQuery] string? grade = null,
        [FromQuery] bool? lowStockOnly = null,
        CancellationToken cancellationToken = default)
    {
        var query = _context.BranchProducts
            .AsNoTracking()
            .Include(bp => bp.Branch)
            .Include(bp => bp.Product)
                .ThenInclude(p => p.Category)
            .Where(bp => bp.IsActive && bp.Product.IsActive);

        // Resolve branch filtering based on caller role & parameters
        Guid? resolvedBranchId = branchId;

        if (!resolvedBranchId.HasValue && !string.IsNullOrWhiteSpace(branch) && !string.Equals(branch, "All", StringComparison.OrdinalIgnoreCase))
        {
            var cleanBranch = branch.Trim().ToLower();
            var matchedBranch = await _context.Branches
                .AsNoTracking()
                .FirstOrDefaultAsync(b =>
                    b.Name.ToLower() == cleanBranch ||
                    b.Code.ToLower() == cleanBranch ||
                    b.Name.ToLower().Contains(cleanBranch) ||
                    cleanBranch.Contains(b.Name.ToLower()),
                    cancellationToken);

            if (matchedBranch != null)
            {
                resolvedBranchId = matchedBranch.Id;
            }
        }

        // If user is not Owner/SuperAdmin (e.g. Branch Manager or Cashier) and no specific branch matched yet,
        // restrict/differentiate strictly based on their user account's assigned branch
        if (!resolvedBranchId.HasValue && !IsOwnerOrAdmin)
        {
            var user = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == UserId, cancellationToken);

            if (user?.BranchId != null)
            {
                resolvedBranchId = user.BranchId;
            }
        }

        // Apply branch differentiation filter
        if (resolvedBranchId.HasValue)
        {
            query = query.Where(bp => bp.BranchId == resolvedBranchId.Value);
        }

        // Search filter (SKU, name, barcode, grade, specs)
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(bp =>
                bp.Product.Name.ToLower().Contains(term) ||
                bp.Product.Sku.ToLower().Contains(term) ||
                (bp.Product.Barcode != null && bp.Product.Barcode.ToLower().Contains(term)) ||
                (bp.Product.Grade != null && bp.Product.Grade.ToLower().Contains(term)) ||
                (bp.Product.Size != null && bp.Product.Size.ToLower().Contains(term)) ||
                (bp.Branch.Name.ToLower().Contains(term)));
        }

        if (categoryId.HasValue)
        {
            query = query.Where(bp => bp.Product.CategoryId == categoryId.Value);
        }

        if (!string.IsNullOrWhiteSpace(grade))
        {
            var g = grade.Trim().ToLower();
            query = query.Where(bp => bp.Product.Grade != null && bp.Product.Grade.ToLower() == g);
        }

        if (lowStockOnly == true)
        {
            query = query.Where(bp => bp.Product.StockQuantity <= 20 || bp.Product.StockQuantity <= bp.ReorderLevel);
        }

        var results = await query
            .OrderBy(bp => bp.Branch.Name)
            .ThenBy(bp => bp.Product.Name)
            .Select(bp => new
            {
                id = bp.Id.ToString(),
                branchId = bp.BranchId.ToString(),
                branchName = bp.Branch.Name,
                branchCode = bp.Branch.Code,
                productId = bp.ProductId.ToString(),
                sku = bp.Product.Sku,
                productName = bp.Product.Name,
                description = bp.Product.Description,
                barcode = bp.Product.Barcode,
                grade = bp.Product.Grade ?? "A36_Structural",
                size = bp.Product.Size,
                thickness = bp.Product.Thickness,
                length = bp.Product.Length,
                unitOfMeasure = bp.Product.UnitOfMeasure,
                sellingPrice = bp.SellingPrice,
                defaultCostPrice = bp.DefaultCostPrice,
                unitPrice = bp.SellingPrice,
                costPrice = bp.DefaultCostPrice,
                reorderLevel = bp.ReorderLevel,
                stockQuantity = (int)bp.Product.StockQuantity,
                currentStock = (int)bp.Product.StockQuantity,
                isAvailable = bp.IsAvailable,
                isActive = bp.IsActive,
                halfPrice = bp.HalfPrice,
                quarterPrice = bp.QuarterPrice,
                threeQuarterPrice = bp.ThreeQuarterPrice,
                categoryName = bp.Product.Category != null ? bp.Product.Category.Name : "General Steel",
                createdAt = bp.CreatedAt,
                updatedAt = bp.UpdatedAt
            })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            success = true,
            totalCount = results.Count,
            data = results
        });
    }

    [HttpGet("pos-batches")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPosBatches(
        [FromQuery] string? branch = null,
        [FromQuery] Guid? branchId = null,
        [FromQuery] string? search = null,
        [FromQuery] string? category = null,
        CancellationToken cancellationToken = default)
    {
        // 1. Resolve branch
        Guid? resolvedBranchId = branchId;
        if (!resolvedBranchId.HasValue && !string.IsNullOrWhiteSpace(branch) && !string.Equals(branch, "All", StringComparison.OrdinalIgnoreCase))
        {
            var cleanBranch = branch.Trim().ToLower();
            var matchedBranch = await _context.Branches
                .AsNoTracking()
                .FirstOrDefaultAsync(b =>
                    b.Name.ToLower() == cleanBranch ||
                    b.Code.ToLower() == cleanBranch ||
                    b.Name.ToLower().Contains(cleanBranch) ||
                    cleanBranch.Contains(b.Name.ToLower()),
                    cancellationToken);

            if (matchedBranch != null)
                resolvedBranchId = matchedBranch.Id;
        }

        if (!resolvedBranchId.HasValue && !IsOwnerOrAdmin)
        {
            var user = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == UserId, cancellationToken);
            if (user?.BranchId != null)
                resolvedBranchId = user.BranchId;
        }

        if (!resolvedBranchId.HasValue)
        {
            var defaultBranch = await _context.Branches.AsNoTracking().FirstOrDefaultAsync(cancellationToken);
            resolvedBranchId = defaultBranch?.Id;
        }

        if (!resolvedBranchId.HasValue)
        {
            return Ok(new { success = true, totalCount = 0, data = Array.Empty<object>() });
        }

        // 2. Query ProductBatches joined with Products and BranchProducts
        // Criteria:
        // - ProductBatch for this branch (or enterprise) with Quantity > 0 and IsActive
        // - Product is active
        // - BranchProduct for this branch is available (IsAvailable == true) and active (IsActive == true)
        var query = from pb in _context.ProductBatches.AsNoTracking()
                    where pb.IsActive && pb.Quantity > 0 && (pb.BranchId == resolvedBranchId.Value || pb.BranchId == null)
                    join p in _context.Products.Include(prod => prod.Category).AsNoTracking() on pb.ProductId equals p.Id
                    where p.IsActive
                    join bp in _context.BranchProducts.AsNoTracking() on new { ProductId = p.Id, BranchId = resolvedBranchId.Value } equals new { bp.ProductId, bp.BranchId }
                    where bp.IsAvailable && bp.IsActive
                    select new
                    {
                        batchId = pb.Id.ToString(),
                        batchCode = pb.BatchCode ?? "INIT-2026",
                        quantity = pb.Quantity,
                        costPrice = pb.CostPrice,
                        batchSellingPrice = pb.SellingPrice,
                        branchSellingPrice = bp.SellingPrice,
                        sellingPrice = bp.SellingPrice > 0 ? bp.SellingPrice : pb.SellingPrice,
                        productId = p.Id.ToString(),
                        productName = p.Name,
                        sku = p.Sku,
                        categoryName = p.Category != null ? p.Category.Name : "General Steel",
                        isAvailable = bp.IsAvailable,
                        isActive = bp.IsActive,
                        branchId = resolvedBranchId.Value.ToString(),
                        dimensions = p.Size ?? p.Thickness ?? p.Description ?? "Standard",
                        grade = p.Grade ?? "SS304_Stainless",
                        unitOfMeasure = p.UnitOfMeasure,
                        receivedDate = pb.ReceivedDate,
                        createdAt = pb.CreatedAt
                    };

        // 3. Category filtering (Stainless Plates, Bars, Sheets, Tubes)
        if (!string.IsNullOrWhiteSpace(category) && !category.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            var cat = category.Trim().ToLower();
            if (cat.Contains("plate")) query = query.Where(x => x.categoryName.ToLower().Contains("plate"));
            else if (cat.Contains("bar")) query = query.Where(x => x.categoryName.ToLower().Contains("bar"));
            else if (cat.Contains("sheet")) query = query.Where(x => x.categoryName.ToLower().Contains("sheet"));
            else if (cat.Contains("tube")) query = query.Where(x => x.categoryName.ToLower().Contains("tube"));
            else query = query.Where(x => x.categoryName.ToLower().Contains(cat));
        }

        // 4. Search filtering
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(x =>
                x.productName.ToLower().Contains(term) ||
                x.sku.ToLower().Contains(term) ||
                x.batchCode.ToLower().Contains(term) ||
                x.grade.ToLower().Contains(term) ||
                x.dimensions.ToLower().Contains(term));
        }

        // 5. FIFO Ordering: Oldest inventory received comes FIRST
        var rawResults = await query
            .OrderBy(x => x.productName)
            .ThenBy(x => x.receivedDate).ThenBy(x => x.createdAt)
            .ToListAsync(cancellationToken);

        // Group by product to mark FIFO priority (old products vs new products)
        var groupedByProduct = rawResults.GroupBy(x => x.productId);
        var fifoResults = new List<object>();

        foreach (var group in groupedByProduct)
        {
            var orderedBatches = group.OrderBy(b => b.receivedDate.ToDateTime(TimeOnly.MinValue)).ThenBy(b => b.createdAt).ToList();
            for (int i = 0; i < orderedBatches.Count; i++)
            {
                var b = orderedBatches[i];
                bool isOldestStock = (i == 0);
                fifoResults.Add(new
                {
                    b.batchId,
                    b.batchCode,
                    b.quantity,
                    b.costPrice,
                    b.batchSellingPrice,
                    b.branchSellingPrice,
                    b.sellingPrice,
                    b.productId,
                    b.productName,
                    b.sku,
                    b.categoryName,
                    b.isAvailable,
                    b.isActive,
                    b.branchId,
                    b.dimensions,
                    b.grade,
                    b.unitOfMeasure,
                    b.receivedDate,
                    b.createdAt,
                    // FIFO Classification: differentiate older batches from newer stock
                    isOldStock = isOldestStock,
                    fifoPriority = isOldestStock,
                    fifoRank = i + 1,
                    fifoStatus = isOldestStock ? "FIFO: Old Stock (Priority)" : $"Newer Batch (Queue #{i + 1})"
                });
            }
        }

        return Ok(new
        {
            success = true,
            totalCount = fifoResults.Count,
            data = fifoResults
        });
    }

    [HttpGet("cross-branch-stock/{productId}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCrossBranchStock(Guid productId, CancellationToken cancellationToken = default)
    {
        var product = await _context.Products
            .Include(p => p.Category)
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == productId, cancellationToken);

        if (product == null)
            return NotFound(new { success = false, message = "Product not found." });

        var branches = await _context.Branches
            .AsNoTracking()
            .Where(b => b.IsActive)
            .OrderBy(b => b.Name)
            .ToListAsync(cancellationToken);

        var branchProducts = await _context.BranchProducts
            .Include(bp => bp.Branch)
            .AsNoTracking()
            .Where(bp => bp.ProductId == productId)
            .ToListAsync(cancellationToken);

        var batches = await _context.ProductBatches
            .AsNoTracking()
            .Where(pb => pb.ProductId == productId && pb.IsActive && pb.Quantity > 0)
            .OrderBy(pb => pb.ReceivedDate)
            .ToListAsync(cancellationToken);

        var branchBreakdown = branches.Select(b =>
        {
            var bp = branchProducts.FirstOrDefault(x => x.BranchId == b.Id);
            var branchBatches = batches.Where(pb => pb.BranchId == b.Id).ToList();
            var totalStock = branchBatches.Count > 0 
                ? branchBatches.Sum(x => x.Quantity) 
                : (bp != null ? (int)product.StockQuantity : 0);

            return new
            {
                branchId = b.Id.ToString(),
                branchName = b.Name,
                branchCode = b.Code,
                stockQuantity = totalStock,
                sellingPrice = bp?.SellingPrice ?? product.UnitPrice,
                defaultCostPrice = bp?.DefaultCostPrice ?? product.CostPrice,
                reorderLevel = bp?.ReorderLevel ?? product.ReorderLevel,
                isAvailable = bp?.IsAvailable ?? true,
                isActive = bp?.IsActive ?? true,
                batchCount = branchBatches.Count,
                oldestBatch = branchBatches.FirstOrDefault()?.BatchCode,
                oldestBatchReceivedDate = branchBatches.FirstOrDefault()?.ReceivedDate,
                batches = branchBatches.Select(batch => new
                {
                    batchId = batch.Id.ToString(),
                    batchCode = batch.BatchCode,
                    quantity = batch.Quantity,
                    sellingPrice = batch.SellingPrice,
                    costPrice = batch.CostPrice,
                    receivedDate = batch.ReceivedDate
                })
            };
        }).ToList();

        return Ok(new
        {
            success = true,
            productId = product.Id.ToString(),
            productName = product.Name,
            sku = product.Sku,
            grade = product.Grade ?? "SS304_Stainless",
            categoryName = product.Category?.Name ?? "General Steel",
            dimensions = product.Size ?? product.Thickness ?? product.Description ?? "Standard",
            unitOfMeasure = product.UnitOfMeasure ?? "pcs",
            totalNetworkStock = branchBreakdown.Sum(x => x.stockQuantity),
            branches = branchBreakdown
        });
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var bp = await _context.BranchProducts
            .AsNoTracking()
            .Include(x => x.Branch)
            .Include(x => x.Product)
                .ThenInclude(p => p.Category)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (bp == null)
            return NotFound(new { message = $"Branch product '{id}' not found." });

        return Ok(new
        {
            id = bp.Id.ToString(),
            branchId = bp.BranchId.ToString(),
            branchName = bp.Branch.Name,
            branchCode = bp.Branch.Code,
            productId = bp.ProductId.ToString(),
            sku = bp.Product.Sku,
            productName = bp.Product.Name,
            description = bp.Product.Description,
            barcode = bp.Product.Barcode,
            grade = bp.Product.Grade ?? "A36_Structural",
            size = bp.Product.Size,
            thickness = bp.Product.Thickness,
            length = bp.Product.Length,
            unitOfMeasure = bp.Product.UnitOfMeasure,
            sellingPrice = bp.SellingPrice,
            defaultCostPrice = bp.DefaultCostPrice,
            unitPrice = bp.SellingPrice,
            costPrice = bp.DefaultCostPrice,
            reorderLevel = bp.ReorderLevel,
            stockQuantity = (int)bp.Product.StockQuantity,
            currentStock = (int)bp.Product.StockQuantity,
            isAvailable = bp.IsAvailable,
            isActive = bp.IsActive,
            categoryName = bp.Product.Category != null ? bp.Product.Category.Name : "General Steel",
            createdAt = bp.CreatedAt
        });
    }
}


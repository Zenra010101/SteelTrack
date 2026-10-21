using SteelTrack.Application.Common;
using SteelTrack.Domain.Constants;
using SteelTrack.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace SteelTrack.Infrastructure.Persistence;

public static class DataSeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        var logger = scope.ServiceProvider.GetService<ILoggerFactory>()?.CreateLogger("DataSeeder");

        await DatabaseInitializer.InitializeAsync(context, configuration, logger);

        await BackfillSaleSnapshotsAsync(context);
        await BackfillGrsFieldsAsync(context);

        var defaultBootstrap = !context.Database.IsNpgsql();
        var bootstrapDemoAccounts = configuration.GetValue("Seed:BootstrapDemoAccounts", defaultBootstrap);
        await EnsureDefaultAccountsAsync(context, bootstrapDemoAccounts);
        await EnsureSteelTrackUsersAsync(context);
        await EnsureDefaultCategoriesAsync(context);
        await EnsureDefaultExpenseCategoriesAsync(context);

        var includeSampleProducts = configuration.GetValue("Seed:IncludeSampleProducts", false);
        if (includeSampleProducts)
        {
            await SampleCatalogSeeder.SeedAsync(context);
            await SampleCatalogSeeder.SeedDemoPartiesAsync(context);
        }
    }

    private static async Task EnsureDefaultCategoriesAsync(AppDbContext context)
    {
        if (await context.Categories.AnyAsync())
            return;

        var categories = CatalogCategories.Defaults
            .Select(c => new Category { Name = c.Name, Description = c.Description })
            .ToArray();

        context.Categories.AddRange(categories);
        await context.SaveChangesAsync();
    }

    private static async Task EnsureDefaultExpenseCategoriesAsync(AppDbContext context)
    {
        if (await context.ExpenseCategories.AnyAsync())
            return;

        var categories = ExpenseDefaultCategories.Defaults
            .Select(c => new ExpenseCategory { Name = c.Name, Description = c.Description })
            .ToArray();

        context.ExpenseCategories.AddRange(categories);
        await context.SaveChangesAsync();
    }

    /// <summary>Ensures roles exist; demo users only when <paramref name="bootstrapDemoAccounts"/> is true.</summary>
    private static async Task EnsureDefaultAccountsAsync(AppDbContext context, bool bootstrapDemoAccounts)
    {
        if (!await context.Roles.AnyAsync())
        {
            var roles = RoleNames.All
                .Select(name => new Role { Name = name, Description = $"{name} role" })
                .ToList();
            context.Roles.AddRange(roles);
            await context.SaveChangesAsync();
        }

        if (!bootstrapDemoAccounts)
            return;

        var ownerRole = await context.Roles.FirstAsync(r => r.Name == RoleNames.Owner);
        var cashierRole = await context.Roles.FirstAsync(r => r.Name == RoleNames.Cashier);

        if (!await context.Users.AnyAsync(u => u.Email == "demo.owner@steeltrack.com"))
        {
            context.Users.Add(new User
            {
                Email = "demo.owner@steeltrack.com",
                FullName = "Stainless Shop Owner",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Owner@123"),
                RoleId = ownerRole.Id,
                IsActive = true
            });
        }

        if (!await context.Users.AnyAsync(u => u.Email == "demo.cashier@steeltrack.com"))
        {
            context.Users.Add(new User
            {
                Email = "demo.cashier@steeltrack.com",
                FullName = "Sales Counter",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Cashier@123"),
                RoleId = cashierRole.Id,
                IsActive = true
            });
        }

        await context.SaveChangesAsync();
    }

    private static async Task EnsureSteelTrackUsersAsync(AppDbContext context)
    {
        var ownerRole = await context.Roles.FirstOrDefaultAsync(r => r.Name == RoleNames.Owner);
        if (ownerRole == null)
        {
            ownerRole = new Role { Name = RoleNames.Owner, Description = "Owner role" };
            context.Roles.Add(ownerRole);
            await context.SaveChangesAsync();
        }

        var managerRole = await context.Roles.FirstOrDefaultAsync(r => r.Name == RoleNames.BranchManager);
        if (managerRole == null)
        {
            managerRole = new Role { Name = RoleNames.BranchManager, Description = "Branch Manager role" };
            context.Roles.Add(managerRole);
            await context.SaveChangesAsync();
        }

        var cashierRole = await context.Roles.FirstOrDefaultAsync(r => r.Name == RoleNames.Cashier);
        if (cashierRole == null)
        {
            cashierRole = new Role { Name = RoleNames.Cashier, Description = "Cashier role" };
            context.Roles.Add(cashierRole);
            await context.SaveChangesAsync();
        }

        var branches = await context.Branches.ToListAsync();
        var davao = branches.FirstOrDefault(b => b.Name.Contains("Davao", StringComparison.OrdinalIgnoreCase))?.Id;
        var mandaue = branches.FirstOrDefault(b => b.Name.Contains("Mandaue", StringComparison.OrdinalIgnoreCase))?.Id;
        var cebu = branches.FirstOrDefault(b => b.Name.Contains("Cebu", StringComparison.OrdinalIgnoreCase))?.Id;
        var cagayan = branches.FirstOrDefault(b => b.Name.Contains("Cagayan", StringComparison.OrdinalIgnoreCase))?.Id;

        var targetUsers = new[]
        {
            (Email: "owner@steeltrack.com", Name: "Alexander Vance", RoleId: ownerRole.Id, BranchId: (Guid?)null, Password: "Owner@SteelTrack2026!"),
            (Email: "demo.owner@steeltrack.com", Name: "Stainless Shop Owner", RoleId: ownerRole.Id, BranchId: (Guid?)null, Password: "Owner@SteelTrack2026!"),
            (Email: "manager.davao@steeltrack.com", Name: "Maria Santos", RoleId: managerRole.Id, BranchId: davao, Password: "DavaoMgr@2026!"),
            (Email: "manager.mandaue@steeltrack.com", Name: "Juan Dela Cruz", RoleId: managerRole.Id, BranchId: mandaue, Password: "MandaueMgr@2026!"),
            (Email: "manager.cebu@steeltrack.com", Name: "Carlos Reyes", RoleId: managerRole.Id, BranchId: cebu, Password: "CebuMgr@2026!"),
            (Email: "manager.cagayan@steeltrack.com", Name: "Ana Gonzales", RoleId: managerRole.Id, BranchId: cagayan, Password: "CagayanMgr@2026!"),
            (Email: "cashier.davao@steeltrack.com", Name: "Rodrigo Tan", RoleId: cashierRole.Id, BranchId: davao, Password: "DavaoCashier@2026!"),
            (Email: "cashier.mandaue@steeltrack.com", Name: "Liza Mercado", RoleId: cashierRole.Id, BranchId: mandaue, Password: "MandaueCashier@2026!"),
            (Email: "cashier.cebu@steeltrack.com", Name: "Mateo Lim", RoleId: cashierRole.Id, BranchId: cebu, Password: "CebuCashier@2026!"),
            (Email: "cashier.cagayan@steeltrack.com", Name: "Elena Ramos", RoleId: cashierRole.Id, BranchId: cagayan, Password: "CagayanCashier@2026!")
        };

        foreach (var u in targetUsers)
        {
            var existing = await context.Users.FirstOrDefaultAsync(x => x.Email.ToLower() == u.Email.ToLower());
            if (existing == null)
            {
                context.Users.Add(new User
                {
                    Email = u.Email,
                    FullName = u.Name,
                    RoleId = u.RoleId,
                    BranchId = u.BranchId,
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(u.Password),
                    IsActive = true
                });
            }
            else
            {
                existing.IsActive = true;
                if (u.BranchId.HasValue) existing.BranchId = u.BranchId;
                existing.PasswordHash = BCrypt.Net.BCrypt.HashPassword(u.Password);
            }
        }

        await context.SaveChangesAsync();
    }

    /// <summary>One-time style backfill for sale lines created before cost snapshots existed.</summary>
    private static async Task BackfillSaleSnapshotsAsync(AppDbContext context)
    {
        var needsBackfill = await context.SaleItems
            .AnyAsync(i => i.CostPriceAtSale == 0 && i.ProfitAmount == 0);
        if (!needsBackfill) return;

        var items = await context.SaleItems
            .Include(i => i.Product)
            .Where(i => i.CostPriceAtSale == 0 && i.ProfitAmount == 0)
            .ToListAsync();

        foreach (var item in items)
        {
            var cost = item.Product?.CostPrice ?? 0;
            var (_, costAtSale, profit) = SaleItemProfit.Compute(
                item.UnitPrice,
                cost,
                item.Quantity,
                item.Discount);
            item.SellingPriceAtSale = item.UnitPrice;
            item.CostPriceAtSale = costAtSale;
            item.ProfitAmount = profit;
        }

        await context.SaveChangesAsync();

        var sales = await context.Sales.Include(s => s.Items).ToListAsync();
        foreach (var sale in sales)
        {
            sale.GrossProfit = sale.Items.Sum(i => i.ProfitAmount);
        }

        await context.SaveChangesAsync();
    }

    private static async Task BackfillGrsFieldsAsync(AppDbContext context)
    {
        var slips = await context.GoodsReturnSlips
            .Include(g => g.OriginalSale)
            .Include(g => g.Items)
            .Where(g => string.IsNullOrEmpty(g.OriginalInvoiceNumber))
            .ToListAsync();

        foreach (var g in slips)
        {
            if (g.OriginalSale is not null)
            {
                g.OriginalInvoiceNumber = g.OriginalSale.SaleNumber;
                g.OriginalSaleDate = g.OriginalSale.CreatedAt;
                g.CustomerName ??= g.OriginalSale.CustomerName;
            }

            foreach (var item in g.Items.Where(i => i.SellingPriceAtSale == 0))
                item.SellingPriceAtSale = item.UnitPrice;
        }

        if (slips.Count > 0)
            await context.SaveChangesAsync();
    }
}

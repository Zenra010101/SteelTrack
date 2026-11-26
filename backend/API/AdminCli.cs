using SteelTrack.Infrastructure.Persistence;
using SteelTrack.Domain.Entities;
using SteelTrack.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace SteelTrack.Api;

internal static class AdminCli
{
    public static bool IsAdminCommand(string[] args) =>
        args.Length > 0 && args[0].Equals("admin", StringComparison.OrdinalIgnoreCase);

    public static async Task<int> RunAsync(WebApplication app, string[] args)
    {
        if (args.Length < 2)
        {
            PrintUsage();
            return 1;
        }

        var sub = args[1].ToLowerInvariant();
        return sub switch
        {
            "set-password" => await SetPasswordAsync(app, args),
            "disable-demo-users" => await DisableDemoUsersAsync(app),
            "inspect" => await InspectAsync(app),
            "seed-sales" => await SeedSalesAsync(app, args),
            _ => PrintUsage()
        };
    }

    private static async Task<int> InspectAsync(WebApplication app)
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var branches = await db.Branches.AsNoTracking().ToListAsync();
        Console.WriteLine($"=== BRANCHES ({branches.Count}) ===");
        foreach (var b in branches)
        {
            var bpCount = await db.BranchProducts.CountAsync(bp => bp.BranchId == b.Id);
            Console.WriteLine($"Branch: {b.Name} (Code: {b.Code}, Id: {b.Id}) -> {bpCount} BranchProducts");
        }

        var users = await db.Users.Include(u => u.Role).Include(u => u.Branch).AsNoTracking().ToListAsync();
        Console.WriteLine($"\n=== USERS ({users.Count}) ===");
        foreach (var u in users)
        {
            Console.WriteLine($"User: {u.FullName} | Email: {u.Email} | Role: {u.Role?.Name} | Branch: {u.Branch?.Name ?? "None"} | Id: {u.Id}");
        }

        var salesCount = await db.Sales.CountAsync();
        var minDate = salesCount > 0 ? await db.Sales.MinAsync(s => s.CreatedAt) : (DateTime?)null;
        var maxDate = salesCount > 0 ? await db.Sales.MaxAsync(s => s.CreatedAt) : (DateTime?)null;
        Console.WriteLine($"\n=== SALES ({salesCount}) ===");
        Console.WriteLine($"Min Date: {minDate}, Max Date: {maxDate}");

        var customers = await db.Customers.AsNoTracking().Take(5).ToListAsync();
        Console.WriteLine($"\n=== CUSTOMERS (Sample {customers.Count}) ===");
        foreach (var c in customers)
        {
            Console.WriteLine($"Customer: {c.Name} (Id: {c.Id})");
        }

        var sampleBp = await db.BranchProducts
            .Include(bp => bp.Product)
            .Include(bp => bp.Branch)
            .Take(5)
            .AsNoTracking()
            .ToListAsync();
        Console.WriteLine($"\n=== SAMPLE BRANCH PRODUCTS ({sampleBp.Count}) ===");
        foreach (var bp in sampleBp)
        {
            Console.WriteLine($"Branch: {bp.Branch?.Name} | Product: {bp.Product?.Name} (Sku: {bp.Product?.Sku}) | Price: {bp.SellingPrice} | Cost: {bp.DefaultCostPrice}");
        }

        return 0;
    }

    private static async Task<int> SeedSalesAsync(WebApplication app, string[] args)
    {
        var fromStr = GetOption(args, "--from") ?? "2026-05-01";
        var toStr = GetOption(args, "--to") ?? "2026-11-26";
        var clearExisting = args.Any(a => a.Equals("--clear-existing", StringComparison.OrdinalIgnoreCase) || a.Equals("--clean", StringComparison.OrdinalIgnoreCase));

        if (!DateTime.TryParse(fromStr, out var fromDate))
            fromDate = new DateTime(2026, 5, 1, 0, 0, 0, DateTimeKind.Utc);
        else
            fromDate = DateTime.SpecifyKind(fromDate, DateTimeKind.Utc);

        if (!DateTime.TryParse(toStr, out var toDate))
            toDate = new DateTime(2026, 11, 26, 23, 59, 59, DateTimeKind.Utc);
        else
            toDate = DateTime.SpecifyKind(toDate, DateTimeKind.Utc);

        Console.WriteLine("=== SEEDING SALES TABLES ===");
        Console.WriteLine($"Date Range: {fromDate:yyyy-MM-dd} to {toDate:yyyy-MM-dd}");
        Console.WriteLine($"Clear Existing Sales: {clearExisting}");

        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        if (clearExisting)
        {
            Console.WriteLine("Clearing existing sales, items, payments, return slips, and references...");
            await db.Database.ExecuteSqlRawAsync("""
                DELETE FROM "GoodsReturnSlipItems";
                DELETE FROM "GoodsReturnSlips";
                DELETE FROM "SalesReturnDeductions";
                DELETE FROM "SalePayments";
                DELETE FROM "SaleItems";
                DELETE FROM "SaleCheques";
                DELETE FROM "CustomerReceivables";
                DELETE FROM "Sales";
            """);
            Console.WriteLine("Existing sales cleared successfully.");
        }

        var branches = await db.Branches.Where(b => b.IsActive).OrderBy(b => b.Name).ToListAsync();
        if (branches.Count == 0)
        {
            Console.Error.WriteLine("Error: No active branches found in database.");
            return 1;
        }

        var allUsers = await db.Users.Include(u => u.Role).Where(u => u.IsActive).ToListAsync();
        var defaultUser = allUsers.FirstOrDefault()
            ?? throw new InvalidOperationException("No active users found to assign sales to.");

        var customers = await db.Customers.Where(c => c.IsActive && !c.IsBlocked).ToListAsync();
        Console.WriteLine($"Loaded {branches.Count} active branches, {allUsers.Count} users, {customers.Count} customers.");

        // Load active branch products per branch
        var branchProductsMap = new Dictionary<Guid, List<BranchProduct>>();
        var productIndexMap = new Dictionary<Guid, int>();
        var seededProductIdsPerBranch = new Dictionary<Guid, HashSet<Guid>>();

        foreach (var branch in branches)
        {
            var bps = await db.BranchProducts
                .Include(bp => bp.Product)
                .Where(bp => bp.BranchId == branch.Id && bp.IsActive && bp.Product != null && bp.Product.IsActive)
                .ToListAsync();

            if (bps.Count == 0)
            {
                Console.WriteLine($"[Warning] Branch {branch.Name} has no BranchProducts!");
                continue;
            }

            // Deterministic shuffle per branch
            var rng = new Random(100 + branch.GetHashCode());
            bps = bps.OrderBy(_ => rng.Next()).ToList();

            branchProductsMap[branch.Id] = bps;
            productIndexMap[branch.Id] = 0;
            seededProductIdsPerBranch[branch.Id] = new HashSet<Guid>();
            Console.WriteLine($"Branch {branch.Name} ({branch.Code}): {bps.Count} active BranchProducts ready for sales seeding.");
        }

        var banks = new[] { "BDO Unibank", "BPI", "Metrobank", "Security Bank", "UnionBank", "RCBC" };
        var globalRng = new Random(42);

        var totalSalesCreated = 0;
        var totalItemsCreated = 0;
        var totalRevenueCreated = 0m;

        // Iterate month by month for performant batch saves
        var currentMonthStart = new DateTime(fromDate.Year, fromDate.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        while (currentMonthStart <= toDate)
        {
            var nextMonthStart = currentMonthStart.AddMonths(1);
            var monthEnd = nextMonthStart.AddTicks(-1);
            if (monthEnd > toDate) monthEnd = toDate;

            var dayStart = currentMonthStart < fromDate ? fromDate.Date : currentMonthStart.Date;
            var dayEnd = monthEnd.Date;

            Console.WriteLine($"\nGenerating sales for {currentMonthStart:yyyy-MM} ({dayStart:yyyy-MM-dd} to {dayEnd:yyyy-MM-dd})...");

            var monthSales = new List<Sale>();
            var monthItems = new List<SaleItem>();
            var monthPayments = new List<SalePayment>();

            for (var day = dayStart; day <= dayEnd; day = day.AddDays(1))
            {
                foreach (var branch in branches)
                {
                    if (!branchProductsMap.TryGetValue(branch.Id, out var bps) || bps.Count == 0)
                        continue;

                    // Cashier for branch
                    var branchUsers = allUsers.Where(u => u.BranchId == branch.Id).ToList();
                    var cashier = branchUsers.FirstOrDefault(u => u.Role?.Name == "Cashier")
                                  ?? branchUsers.FirstOrDefault(u => u.Role?.Name == "Branch Manager")
                                  ?? branchUsers.FirstOrDefault()
                                  ?? defaultUser;

                    // Daily volume based on day of week
                    int salesCountForDay;
                    if (day.DayOfWeek == DayOfWeek.Sunday)
                        salesCountForDay = globalRng.Next(1, 3);
                    else if (day.DayOfWeek == DayOfWeek.Saturday)
                        salesCountForDay = globalRng.Next(3, 6);
                    else
                        salesCountForDay = globalRng.Next(5, 9);

                    var bCode = string.IsNullOrWhiteSpace(branch.Code) ? "BR" : branch.Code.Trim().ToUpperInvariant();

                    for (var sIdx = 1; sIdx <= salesCountForDay; sIdx++)
                    {
                        var saleId = Guid.NewGuid();
                        var hour = globalRng.Next(8, 17);
                        var minute = globalRng.Next(0, 60);
                        var second = globalRng.Next(0, 60);
                        var saleDateUtc = new DateTime(day.Year, day.Month, day.Day, hour, minute, second, DateTimeKind.Utc);

                        var saleNumber = $"S{day:yyyyMMdd}-{bCode}-{sIdx:D3}";

                        // 1 to 4 line items per sale
                        var itemCount = globalRng.Next(1, 5);
                        var saleItemsList = new List<SaleItem>();

                        for (var i = 0; i < itemCount; i++)
                        {
                            var pIdx = productIndexMap[branch.Id]++;
                            var bp = bps[pIdx % bps.Count];
                            seededProductIdsPerBranch[branch.Id].Add(bp.ProductId);

                            var unitPrice = bp.SellingPrice > 0
                                ? bp.SellingPrice
                                : (bp.Product.UnitPrice > 0 ? bp.Product.UnitPrice : 750m);

                            var costPrice = bp.DefaultCostPrice > 0
                                ? bp.DefaultCostPrice
                                : (bp.Product.CostPrice > 0 ? bp.Product.CostPrice : Math.Round(unitPrice * 0.68m, 2));

                            var qty = globalRng.Next(1, 6);
                            var lineTotal = Math.Round(qty * unitPrice, 2);
                            var profit = Math.Round(lineTotal - (qty * costPrice), 2);

                            var item = new SaleItem
                            {
                                Id = Guid.NewGuid(),
                                SaleId = saleId,
                                ProductId = bp.ProductId,
                                ProductName = bp.Product.Name,
                                ProductSku = bp.Product.Sku,
                                Quantity = qty,
                                UnitPrice = unitPrice,
                                SellingPriceAtSale = unitPrice,
                                CostPriceAtSale = costPrice,
                                ProfitAmount = profit,
                                Discount = 0,
                                LineTotal = lineTotal,
                                ReturnedQuantity = 0,
                                PendingReturnQuantity = 0,
                                CreatedAt = saleDateUtc
                            };

                            saleItemsList.Add(item);
                            monthItems.Add(item);
                        }

                        var subTotal = saleItemsList.Sum(it => it.LineTotal);
                        var taxAmount = Math.Round(subTotal * 0.12m, 2);
                        var totalAmount = subTotal + taxAmount;
                        var grossProfit = saleItemsList.Sum(it => it.ProfitAmount);

                        // Payment method weighted distribution
                        var payRoll = globalRng.Next(100);
                        PaymentMethod method;
                        if (payRoll < 45) method = PaymentMethod.Cash;
                        else if (payRoll < 70) method = PaymentMethod.OnlineBank;
                        else if (payRoll < 85) method = PaymentMethod.QRPH;
                        else if (payRoll < 95) method = PaymentMethod.Charged;
                        else method = PaymentMethod.Cheque;

                        var amountPaid = totalAmount;
                        var changeAmount = 0m;
                        if (method == PaymentMethod.Cash)
                        {
                            if (globalRng.Next(100) < 40)
                            {
                                var rounded = Math.Ceiling(totalAmount / 100m) * 100m;
                                if (rounded >= totalAmount)
                                {
                                    amountPaid = rounded;
                                    changeAmount = amountPaid - totalAmount;
                                }
                            }
                        }

                        // Customer assignment
                        string custName;
                        Guid? custId = null;
                        if (customers.Count > 0 && (method == PaymentMethod.Charged || globalRng.Next(100) < 65))
                        {
                            var c = customers[globalRng.Next(customers.Count)];
                            custName = c.Name;
                            custId = c.Id;
                        }
                        else
                        {
                            custName = "Walk-in Client";
                        }

                        var sale = new Sale
                        {
                            Id = saleId,
                            SaleNumber = saleNumber,
                            UserId = cashier.Id,
                            BranchId = branch.Id,
                            SubTotal = subTotal,
                            DiscountPercent = 0,
                            DiscountAmount = 0,
                            TaxMode = SaleTaxMode.Vat12,
                            TaxTypeLabel = "VAT (12%)",
                            TaxRate = 12m,
                            TaxAmount = taxAmount,
                            WithholdingAmount = 0,
                            TotalAmount = totalAmount,
                            GrossProfit = grossProfit,
                            AmountPaid = amountPaid,
                            ChangeAmount = changeAmount,
                            PaymentMethod = method,
                            Status = SaleStatus.Completed,
                            IsArchived = false,
                            CustomerName = custName,
                            CustomerId = custId,
                            CreatedAt = saleDateUtc
                        };

                        var payment = new SalePayment
                        {
                            Id = Guid.NewGuid(),
                            SaleId = saleId,
                            Method = method,
                            Amount = totalAmount,
                            DatePaid = saleDateUtc,
                            CreatedAt = saleDateUtc
                        };

                        if (method == PaymentMethod.OnlineBank)
                        {
                            payment.BankName = banks[globalRng.Next(banks.Length)];
                            payment.BankReferenceNumber = $"REF-{globalRng.Next(100000, 999999)}";
                        }
                        else if (method == PaymentMethod.QRPH)
                        {
                            payment.QrphReference = $"QR-{globalRng.Next(100000, 999999)}";
                        }

                        monthSales.Add(sale);
                        monthPayments.Add(payment);
                    }
                }
            }

            // Save month batch
            await db.Sales.AddRangeAsync(monthSales);
            await db.SaleItems.AddRangeAsync(monthItems);
            await db.SalePayments.AddRangeAsync(monthPayments);
            await db.SaveChangesAsync();
            db.ChangeTracker.Clear();

            var monthRevenue = monthSales.Sum(s => s.TotalAmount);
            totalSalesCreated += monthSales.Count;
            totalItemsCreated += monthItems.Count;
            totalRevenueCreated += monthRevenue;

            Console.WriteLine($"[SAVED] {currentMonthStart:yyyy-MM}: {monthSales.Count:N0} sales, {monthItems.Count:N0} items, Subtotal Revenue: PHP {monthRevenue:N2}");

            currentMonthStart = nextMonthStart;
        }

        Console.WriteLine("\n=== SALES SEEDING COMPLETE ===");
        Console.WriteLine($"Total Sales Created: {totalSalesCreated:N0}");
        Console.WriteLine($"Total Line Items: {totalItemsCreated:N0}");
        Console.WriteLine($"Total Revenue Seeded: PHP {totalRevenueCreated:N2}");

        // Product coverage verification across branches
        Console.WriteLine("\n=== BRANCH PRODUCT COVERAGE AUDIT ===");
        foreach (var branch in branches)
        {
            if (branchProductsMap.TryGetValue(branch.Id, out var bps) && bps.Count > 0)
            {
                var seededCount = seededProductIdsPerBranch[branch.Id].Count;
                var totalCount = bps.Count;
                var coverage = (double)seededCount / totalCount * 100.0;
                Console.WriteLine($"Branch {branch.Name} ({branch.Code}): {seededCount} / {totalCount} distinct products sold ({coverage:F1}% coverage)");
            }
        }

        return 0;
    }

    private static async Task<int> SetPasswordAsync(WebApplication app, string[] args)
    {
        var email = GetOption(args, "--email")?.Trim().ToLowerInvariant();
        var password = GetOption(args, "--password");
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            Console.Error.WriteLine("Usage: admin set-password --email <email> --password <password>");
            return 1;
        }

        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user is null)
        {
            Console.Error.WriteLine($"User not found: {email}");
            return 1;
        }

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(password);
        await db.SaveChangesAsync();
        Console.WriteLine($"Password updated for {email}");
        return 0;
    }

    private static async Task<int> DisableDemoUsersAsync(WebApplication app)
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var demos = new[] { "demo.owner@steeltrack.com", "demo.cashier@steeltrack.com" };
        var users = await db.Users.Where(u => demos.Contains(u.Email)).ToListAsync();
        foreach (var u in users)
            u.IsActive = false;

        await db.SaveChangesAsync();
        Console.WriteLine($"Deactivated {users.Count} demo account(s). Create new users in Settings → Users.");
        return 0;
    }

    private static string? GetOption(string[] args, string name)
    {
        for (var i = 0; i < args.Length - 1; i++)
        {
            if (args[i].Equals(name, StringComparison.OrdinalIgnoreCase))
                return args[i + 1];
        }

        return null;
    }

    private static int PrintUsage()
    {
        Console.WriteLine("""
            Admin commands (run after deploy):
              admin set-password --email <email> --password <password>
              admin disable-demo-users
              admin inspect
              admin seed-sales [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--clear-existing]
            """);
        return 1;
    }
}

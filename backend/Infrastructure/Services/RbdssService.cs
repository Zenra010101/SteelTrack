using System.Diagnostics;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using SteelTrack.Application.DTOs.Rbdss;
using SteelTrack.Application.Interfaces;
using SteelTrack.Domain.Entities;
using SteelTrack.Infrastructure.Persistence;

namespace SteelTrack.Infrastructure.Services;

public sealed class RbdssService : IRbdssService
{
    private readonly AppDbContext _context;
    private readonly ILstmForecastService _lstmForecastService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<RbdssService> _logger;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public RbdssService(
        AppDbContext context,
        ILstmForecastService lstmForecastService,
        IConfiguration configuration,
        ILogger<RbdssService> logger)
    {
        _context = context;
        _lstmForecastService = lstmForecastService;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<RbdssResponseDto> GetRecommendationsAsync(
        RbdssRequestDto request,
        CancellationToken cancellationToken = default)
    {
        var targetPeriod = string.IsNullOrWhiteSpace(request.Period)
            ? DateTime.UtcNow.ToString("yyyy-MM")
            : request.Period.Trim();

        // 1. Fetch metadata from database
        var branches = await _context.Branches
            .AsNoTracking()
            .Where(b => b.IsActive && (!request.BranchId.HasValue || b.Id == request.BranchId.Value))
            .ToListAsync(cancellationToken);

        var products = await _context.Products
            .AsNoTracking()
            .Include(p => p.Batches)
            .Where(p => p.IsActive && (!request.ProductId.HasValue || p.Id == request.ProductId.Value))
            .ToListAsync(cancellationToken);

        var branchMap = branches.ToDictionary(b => b.Id.ToString().ToLowerInvariant(), b => b);
        var productMap = products.ToDictionary(p => p.Id.ToString().ToLowerInvariant(), p => p);

        // 2. Prepare forecast input list
        List<RbdssForecastInputDto> forecastInputs;
        if (request.Forecasts != null && request.Forecasts.Count > 0)
        {
            forecastInputs = request.Forecasts;
        }
        else
        {
            forecastInputs = await BuildForecastInputsAsync(branches, products, targetPeriod, cancellationToken);
        }

        // 3. Prepare inventory input list
        List<RbdssInventoryInputDto> inventoryInputs;
        if (request.Inventory != null && request.Inventory.Count > 0)
        {
            inventoryInputs = request.Inventory;
        }
        else
        {
            inventoryInputs = BuildInventoryInputs(branches, products, targetPeriod, forecastInputs);
        }

        // 4. Try Python RBDSS CLI Bridge
        RbdssResponseDto? pythonResult = await TryRunPythonCliAsync(forecastInputs, inventoryInputs, request.DonorStrategy, cancellationToken);
        if (pythonResult != null && pythonResult.Success)
        {
            EnrichWithMetadata(pythonResult, branchMap, productMap);
            return pythonResult;
        }

        // 5. Fallback to C# Rule-Based Decision Support System Engine
        _logger.LogInformation("Executing C# Section 2.3.2.2 RBDSS Rule Engine fallback");
        var csharpResult = RunCSharpRbdssEngine(forecastInputs, inventoryInputs, request.DonorStrategy);
        EnrichWithMetadata(csharpResult, branchMap, productMap);
        return csharpResult;
    }

    private async Task<List<RbdssForecastInputDto>> BuildForecastInputsAsync(
        List<Branch> branches,
        List<Product> products,
        string targetPeriod,
        CancellationToken cancellationToken)
    {
        var result = new List<RbdssForecastInputDto>();

        try
        {
            // Request forecast from LSTM service for next 3 months
            var now = DateTime.UtcNow;
            var fromMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var toMonth = fromMonth.AddMonths(3);

            var forecastResp = await _lstmForecastService.GetForecastAsync(
                fromMonth, toMonth, null, null, null, cancellationToken);

            var forecastDict = forecastResp.Forecasts
                .Where(f => f.Month == targetPeriod || f.Month.StartsWith(targetPeriod))
                .ToDictionary(f => f.ProductId, f => f.PredictedQuantity);

            foreach (var b in branches)
            {
                var bId = b.Id.ToString().ToLowerInvariant();
                foreach (var p in products)
                {
                    var pId = p.Id.ToString().ToLowerInvariant();
                    decimal demand = 0;
                    if (forecastDict.TryGetValue(p.Id, out var qty))
                    {
                        // Distribute proportionally across active branches
                        var share = branches.Count > 0 ? 1.0m / branches.Count : 1.0m;
                        demand = Math.Max(0, Math.Round(qty * share));
                    }
                    else
                    {
                        demand = Math.Max(10, p.ReorderLevel);
                    }

                    result.Add(new RbdssForecastInputDto
                    {
                        BranchId = bId,
                        ProductId = pId,
                        Period = targetPeriod,
                        ForecastedDemand = demand,
                    });
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to load upstream LSTM forecasts; using default reorder metrics");
            foreach (var b in branches)
            {
                var bId = b.Id.ToString().ToLowerInvariant();
                foreach (var p in products)
                {
                    result.Add(new RbdssForecastInputDto
                    {
                        BranchId = bId,
                        ProductId = p.Id.ToString().ToLowerInvariant(),
                        Period = targetPeriod,
                        ForecastedDemand = Math.Max(10, p.ReorderLevel),
                    });
                }
            }
        }

        return result;
    }

    private static List<RbdssInventoryInputDto> BuildInventoryInputs(
        List<Branch> branches,
        List<Product> products,
        string targetPeriod,
        List<RbdssForecastInputDto> forecasts)
    {
        var demandLookup = forecasts.ToDictionary(
            f => $"{f.BranchId}_{f.ProductId}_{f.Period}",
            f => f.ForecastedDemand);

        var list = new List<RbdssInventoryInputDto>();

        foreach (var b in branches)
        {
            var bId = b.Id.ToString().ToLowerInvariant();
            foreach (var p in products)
            {
                var pId = p.Id.ToString().ToLowerInvariant();

                // Compute physical stock in this branch from active batches
                var branchBatches = p.Batches
                    .Where(batch => batch.IsActive && batch.BranchId == b.Id)
                    .ToList();

                decimal currentStock = branchBatches.Count > 0
                    ? branchBatches.Sum(batch => (decimal)batch.Quantity)
                    : (branches.Count > 0 ? Math.Round((decimal)p.StockQuantity / branches.Count) : p.StockQuantity);

                decimal incoming = 0;
                decimal reserved = 0;

                // Safety Stock default: max(5, 15% of forecasted demand)
                var key = $"{bId}_{pId}_{targetPeriod}";
                var demand = demandLookup.TryGetValue(key, out var d) ? d : Math.Max(10, p.ReorderLevel);
                decimal safetyStock = Math.Max(5, Math.Round(demand * 0.15m));

                list.Add(new RbdssInventoryInputDto
                {
                    BranchId = bId,
                    ProductId = pId,
                    Period = targetPeriod,
                    CurrentStock = Math.Max(0, currentStock),
                    IncomingStock = incoming,
                    ReservedStock = reserved,
                    SafetyStock = safetyStock,
                });
            }
        }

        return list;
    }

    private async Task<RbdssResponseDto?> TryRunPythonCliAsync(
        List<RbdssForecastInputDto> forecasts,
        List<RbdssInventoryInputDto> inventory,
        string? donorStrategy,
        CancellationToken cancellationToken)
    {
        try
        {
            var pythonExe = FindPythonExecutable();
            var cliScript = FindCliScript();

            if (string.IsNullOrEmpty(pythonExe) || string.IsNullOrEmpty(cliScript))
            {
                _logger.LogDebug("Python executable or rbdss/cli.py not found on filesystem; will use C# fallback");
                return null;
            }

            var payload = new
            {
                forecasts = forecasts.Select(f => new
                {
                    branch_id = f.BranchId,
                    product_id = f.ProductId,
                    period = f.Period,
                    forecasted_demand = f.ForecastedDemand,
                }).ToList(),
                inventory = inventory.Select(i => new
                {
                    branch_id = i.BranchId,
                    product_id = i.ProductId,
                    period = i.Period,
                    current_stock = i.CurrentStock,
                    incoming_stock = i.IncomingStock,
                    reserved_stock = i.ReservedStock,
                    safety_stock = i.SafetyStock,
                }).ToList(),
                config = new
                {
                    donor_strategy = donorStrategy ?? "LARGEST_ES_FIRST",
                },
            };

            var inputJson = JsonSerializer.Serialize(payload);

            var psi = new ProcessStartInfo
            {
                FileName = pythonExe,
                Arguments = $"\"{cliScript}\" --stdin",
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };

            using var process = new Process { StartInfo = psi };
            process.Start();

            await process.StandardInput.WriteAsync(inputJson.AsMemory(), cancellationToken);
            await process.StandardInput.FlushAsync(cancellationToken);
            process.StandardInput.Close();

            var stdoutTask = process.StandardOutput.ReadToEndAsync(cancellationToken);
            var stderrTask = process.StandardError.ReadToEndAsync(cancellationToken);

            var exited = await Task.Run(() => process.WaitForExit(10000), cancellationToken);
            if (!exited)
            {
                try { process.Kill(); } catch { }
                _logger.LogWarning("Python RBDSS CLI timed out after 10s");
                return null;
            }

            var stdout = await stdoutTask;
            var stderr = await stderrTask;

            if (process.ExitCode != 0 || string.IsNullOrWhiteSpace(stdout))
            {
                _logger.LogWarning("Python RBDSS CLI exited with code {Code}: {Err}", process.ExitCode, stderr);
                return null;
            }

            var parsed = JsonSerializer.Deserialize<RbdssResponseDto>(stdout, JsonOpts);
            if (parsed != null && parsed.Success)
            {
                parsed.Engine = "python_rbdss";
                return parsed;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to invoke Python RBDSS CLI bridge");
        }

        return null;
    }

    private static string? FindPythonExecutable()
    {
        var candidates = new[]
        {
            Path.Combine(Directory.GetCurrentDirectory(), "python-lstm-service", ".venv", "Scripts", "python.exe"),
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "python-lstm-service", ".venv", "Scripts", "python.exe"),
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "python-lstm-service", ".venv", "Scripts", "python.exe"),
            "python.exe",
            "python",
        };

        foreach (var c in candidates)
        {
            try
            {
                var full = Path.GetFullPath(c);
                if (File.Exists(full)) return full;
            }
            catch { }
        }

        return "python";
    }

    private static string? FindCliScript()
    {
        var candidates = new[]
        {
            Path.Combine(Directory.GetCurrentDirectory(), "rbdss", "cli.py"),
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "rbdss", "cli.py"),
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "rbdss", "cli.py"),
        };

        foreach (var c in candidates)
        {
            try
            {
                var full = Path.GetFullPath(c);
                if (File.Exists(full)) return full;
            }
            catch { }
        }

        return null;
    }

    /// <summary>
    /// Pure C# Implementation of Section 2.3.2.2 Rule-Based Decision Support System.
    /// Strictly satisfies Rules 1–5 and multi-branch lateral transshipment matching.
    /// </summary>
    public static RbdssResponseDto RunCSharpRbdssEngine(
        List<RbdssForecastInputDto> forecasts,
        List<RbdssInventoryInputDto> inventory,
        string? donorStrategy = "LARGEST_ES_FIRST")
    {
        var response = new RbdssResponseDto
        {
            Success = true,
            Engine = "csharp_fallback",
        };

        // Group inputs by (product_id, period)
        var productPeriods = inventory
            .Select(i => (ProductId: i.ProductId, Period: i.Period))
            .Distinct()
            .ToList();

        var forecastMap = forecasts.ToDictionary(
            f => $"{f.BranchId}_{f.ProductId}_{f.Period}",
            f => f.ForecastedDemand);

        var allTransfers = new List<RbdssTransferDto>();
        var allRecommendations = new List<RbdssRecommendationDto>();
        var allProcurements = new List<RbdssProcurementDto>();
        var allAllocations = new List<RbdssAllocationDto>();

        foreach (var (productId, period) in productPeriods)
        {
            var branchInvList = inventory
                .Where(i => i.ProductId == productId && i.Period == period)
                .ToList();

            // 1. Initial State Calculations per Branch
            // PAS = Current + Incoming - Reserved
            // RS = Forecasted Demand + Safety Stock
            // NIR = max(0, RS - PAS)
            // ES = max(0, PAS - RS)
            var state = branchInvList.Select(inv =>
            {
                var key = $"{inv.BranchId}_{productId}_{period}";
                var demand = forecastMap.TryGetValue(key, out var d) ? d : 0m;
                var pas = Math.Max(0m, inv.CurrentStock + inv.IncomingStock - inv.ReservedStock);
                var rs = demand + inv.SafetyStock;
                var nir = Math.Max(0m, rs - pas);
                var es = Math.Max(0m, pas - rs);

                return new
                {
                    inv.BranchId,
                    inv.CurrentStock,
                    inv.IncomingStock,
                    inv.ReservedStock,
                    inv.SafetyStock,
                    ForecastedDemand = demand,
                    Pas = pas,
                    Rs = rs,
                    Nir = nir,
                    Es = es,
                    RemainingEs = es,
                    TransfersReceived = 0m,
                    TransfersDonated = 0m,
                    ProcurementQuantity = 0m,
                };
            }).ToList();

            // 2. Separate Donors and Recipients
            var recipients = state.Where(s => s.Nir > 0m).OrderByDescending(s => s.Nir).ToList();
            var donors = state.Where(s => s.Es > 0m).OrderByDescending(s => s.RemainingEs).ToList();

            var branchTransfers = new List<RbdssTransferDto>();
            var recipientTransfersMap = new Dictionary<string, List<RbdssTransferDto>>();
            var netTransfersMap = state.ToDictionary(s => s.BranchId, s => 0m);
            var procurementMap = state.ToDictionary(s => s.BranchId, s => 0m);

            // 3. Multi-branch Lateral Transshipment Matching
            foreach (var rec in recipients)
            {
                var needed = rec.Nir;
                var recTransfers = new List<RbdssTransferDto>();

                foreach (var donor in donors)
                {
                    if (needed <= 0m) break;
                    if (donor.RemainingEs <= 0m || donor.BranchId == rec.BranchId) continue;

                    var qty = Math.Min(needed, donor.RemainingEs);
                    if (qty > 0m)
                    {
                        var t = new RbdssTransferDto
                        {
                            DonorBranchId = donor.BranchId,
                            RecipientBranchId = rec.BranchId,
                            ProductId = productId,
                            Period = period,
                            TransferQuantity = qty,
                        };
                        recTransfers.Add(t);
                        branchTransfers.Add(t);

                        // Mutate donor remaining ES
                        var donorIdx = donors.IndexOf(donor);
                        donors[donorIdx] = donor with
                        {
                            RemainingEs = donor.RemainingEs - qty,
                            TransfersDonated = donor.TransfersDonated + qty,
                        };

                        netTransfersMap[donor.BranchId] -= qty;
                        netTransfersMap[rec.BranchId] += qty;
                        needed -= qty;
                    }
                }

                recipientTransfersMap[rec.BranchId] = recTransfers;
                procurementMap[rec.BranchId] = needed; // Remainder must be procured
            }

            // 4. Formulate Branch Recommendations (Rules 1-5)
            foreach (var s in state)
            {
                var recTransfers = recipientTransfersMap.TryGetValue(s.BranchId, out var rlist) ? rlist : [];
                var tq = recTransfers.Sum(t => t.TransferQuantity);
                var pq = procurementMap.TryGetValue(s.BranchId, out var pqty) ? pqty : 0m;

                string rule;
                string action;
                string explanation;

                if (s.Pas >= s.Rs)
                {
                    // Rule 1: Sufficient Inventory
                    rule = "Rule 1 (Sufficient Inventory)";
                    action = "KEEP";
                    explanation = $"PAS ({s.Pas}) >= RS ({s.Rs}). Inventory is sufficient. No action required.";
                }
                else
                {
                    // Inventory Shortage (Rule 2 condition detected)
                    if (tq > 0m && pq == 0m)
                    {
                        // Rule 3: Inter-Branch Transfer
                        rule = "Rule 3 (Inter-Branch Transfer)";
                        action = "TRANSFER";
                        explanation = $"Shortage NIR ({s.Nir}) fully resolved via lateral transfer of {tq} units.";
                    }
                    else if (tq > 0m && pq > 0m)
                    {
                        // Rule 4: Partial Transfer + Procurement
                        rule = "Rule 4 (Partial Transfer + Procurement)";
                        action = "TRANSFER + PROCURE";
                        explanation = $"Shortage NIR ({s.Nir}) partially resolved: {tq} units transferred, remainder {pq} units procured.";
                    }
                    else
                    {
                        // Rule 5: Procurement
                        rule = "Rule 5 (Procurement)";
                        action = "PROCURE";
                        explanation = $"No donor surplus available. Procure {pq} units from external supplier.";
                    }
                }

                allRecommendations.Add(new RbdssRecommendationDto
                {
                    BranchId = s.BranchId,
                    ProductId = productId,
                    Period = period,
                    CurrentStock = s.CurrentStock,
                    IncomingStock = s.IncomingStock,
                    ReservedStock = s.ReservedStock,
                    SafetyStock = s.SafetyStock,
                    ForecastedDemand = s.ForecastedDemand,
                    Pas = s.Pas,
                    Rs = s.Rs,
                    Nir = s.Nir,
                    Es = s.Es,
                    RuleTriggered = rule,
                    Action = action,
                    TransferQuantity = tq,
                    ProcurementQuantity = pq,
                    Explanation = explanation,
                    Status = "Pending Management Approval",
                    Transfers = recTransfers,
                });

                // Posture & Allocation
                var net = netTransfersMap[s.BranchId];
                var post = s.Pas >= s.Rs
                    ? (net < 0 ? "Surplus Donor" : "Sufficient")
                    : (pq > 0 ? "Procuring" : "Replenished by Transfer");

                allAllocations.Add(new RbdssAllocationDto
                {
                    BranchId = s.BranchId,
                    ProductId = productId,
                    Period = period,
                    Pas = s.Pas,
                    Rs = s.Rs,
                    NetTransfers = net,
                    Procurement = pq,
                    ProjectedClosingStock = Math.Max(0m, s.Pas + net + pq - s.Rs),
                    InventoryPosture = post,
                });
            }

            allTransfers.AddRange(branchTransfers);

            // Enterprise Consolidated Procurement Summary
            var totalProcure = procurementMap.Values.Sum();
            if (totalProcure > 0m)
            {
                allProcurements.Add(new RbdssProcurementDto
                {
                    ProductId = productId,
                    Period = period,
                    TotalProcurementQuantity = totalProcure,
                    BranchBreakdown = procurementMap
                        .Where(kv => kv.Value > 0m)
                        .Select(kv => new RbdssProcurementBranchBreakdownDto
                        {
                            BranchId = kv.Key,
                            ProcurementQuantity = kv.Value,
                        }).ToList(),
                });
            }
        }

        response.Recommendations = allRecommendations;
        response.Transfers = allTransfers;
        response.ProcurementSummary = allProcurements;
        response.AllocationSummary = allAllocations;

        return response;
    }

    private static void EnrichWithMetadata(
        RbdssResponseDto result,
        Dictionary<string, Branch> branchMap,
        Dictionary<string, Product> productMap)
    {
        foreach (var r in result.Recommendations)
        {
            var bId = r.BranchId.ToLowerInvariant();
            if (branchMap.TryGetValue(bId, out var b)) r.BranchName = b.Name;

            var pId = r.ProductId.ToLowerInvariant();
            if (productMap.TryGetValue(pId, out var p))
            {
                r.ProductName = p.Name;
                r.ProductSku = p.Sku;
            }

            foreach (var t in r.Transfers)
            {
                if (branchMap.TryGetValue(t.DonorBranchId.ToLowerInvariant(), out var db)) t.DonorBranchName = db.Name;
                if (branchMap.TryGetValue(t.RecipientBranchId.ToLowerInvariant(), out var rb)) t.RecipientBranchName = rb.Name;
                if (productMap.TryGetValue(t.ProductId.ToLowerInvariant(), out var tp))
                {
                    t.ProductName = tp.Name;
                    t.ProductSku = tp.Sku;
                }
            }
        }

        foreach (var t in result.Transfers)
        {
            if (branchMap.TryGetValue(t.DonorBranchId.ToLowerInvariant(), out var db)) t.DonorBranchName = db.Name;
            if (branchMap.TryGetValue(t.RecipientBranchId.ToLowerInvariant(), out var rb)) t.RecipientBranchName = rb.Name;
            if (productMap.TryGetValue(t.ProductId.ToLowerInvariant(), out var tp))
            {
                t.ProductName = tp.Name;
                t.ProductSku = tp.Sku;
            }
        }

        foreach (var p in result.ProcurementSummary)
        {
            if (productMap.TryGetValue(p.ProductId.ToLowerInvariant(), out var prod))
            {
                p.ProductName = prod.Name;
                p.ProductSku = prod.Sku;
            }
            foreach (var bb in p.BranchBreakdown)
            {
                if (branchMap.TryGetValue(bb.BranchId.ToLowerInvariant(), out var b)) bb.BranchName = b.Name;
            }
        }

        foreach (var a in result.AllocationSummary)
        {
            if (branchMap.TryGetValue(a.BranchId.ToLowerInvariant(), out var b)) a.BranchName = b.Name;
            if (productMap.TryGetValue(a.ProductId.ToLowerInvariant(), out var prod))
            {
                a.ProductName = prod.Name;
                a.ProductSku = prod.Sku;
            }
        }
    }
}


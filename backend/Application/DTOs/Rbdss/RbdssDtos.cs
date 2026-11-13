using System.Text.Json.Serialization;

namespace SteelTrack.Application.DTOs.Rbdss;

public class RbdssRequestDto
{
    public string? Period { get; set; }
    public Guid? BranchId { get; set; }
    public Guid? ProductId { get; set; }
    public string? DonorStrategy { get; set; } = "LARGEST_ES_FIRST";
    public List<RbdssForecastInputDto>? Forecasts { get; set; }
    public List<RbdssInventoryInputDto>? Inventory { get; set; }
}

public class RbdssForecastInputDto
{
    [JsonPropertyName("branch_id")]
    public string BranchId { get; set; } = string.Empty;

    [JsonPropertyName("product_id")]
    public string ProductId { get; set; } = string.Empty;

    [JsonPropertyName("period")]
    public string Period { get; set; } = string.Empty;

    [JsonPropertyName("forecasted_demand")]
    public decimal ForecastedDemand { get; set; }
}

public class RbdssInventoryInputDto
{
    [JsonPropertyName("branch_id")]
    public string BranchId { get; set; } = string.Empty;

    [JsonPropertyName("product_id")]
    public string ProductId { get; set; } = string.Empty;

    [JsonPropertyName("period")]
    public string Period { get; set; } = string.Empty;

    [JsonPropertyName("current_stock")]
    public decimal CurrentStock { get; set; }

    [JsonPropertyName("incoming_stock")]
    public decimal IncomingStock { get; set; }

    [JsonPropertyName("reserved_stock")]
    public decimal ReservedStock { get; set; }

    [JsonPropertyName("safety_stock")]
    public decimal SafetyStock { get; set; }
}

public class RbdssResponseDto
{
    [JsonPropertyName("success")]
    public bool Success { get; set; } = true;

    [JsonPropertyName("engine")]
    public string Engine { get; set; } = "python_rbdss";

    [JsonPropertyName("recommendations")]
    public List<RbdssRecommendationDto> Recommendations { get; set; } = [];

    [JsonPropertyName("transfers")]
    public List<RbdssTransferDto> Transfers { get; set; } = [];

    [JsonPropertyName("procurement_summary")]
    public List<RbdssProcurementDto> ProcurementSummary { get; set; } = [];

    [JsonPropertyName("allocation_summary")]
    public List<RbdssAllocationDto> AllocationSummary { get; set; } = [];

    [JsonPropertyName("audit_logs")]
    public List<Dictionary<string, object>> AuditLogs { get; set; } = [];
}

public class RbdssRecommendationDto
{
    [JsonPropertyName("branch_id")]
    public string BranchId { get; set; } = string.Empty;

    [JsonPropertyName("branch_name")]
    public string? BranchName { get; set; }

    [JsonPropertyName("product_id")]
    public string ProductId { get; set; } = string.Empty;

    [JsonPropertyName("product_sku")]
    public string? ProductSku { get; set; }

    [JsonPropertyName("product_name")]
    public string? ProductName { get; set; }

    [JsonPropertyName("period")]
    public string Period { get; set; } = string.Empty;

    [JsonPropertyName("current_stock")]
    public decimal CurrentStock { get; set; }

    [JsonPropertyName("incoming_stock")]
    public decimal IncomingStock { get; set; }

    [JsonPropertyName("reserved_stock")]
    public decimal ReservedStock { get; set; }

    [JsonPropertyName("safety_stock")]
    public decimal SafetyStock { get; set; }

    [JsonPropertyName("forecasted_demand")]
    public decimal ForecastedDemand { get; set; }

    [JsonPropertyName("pas")]
    public decimal Pas { get; set; }

    [JsonPropertyName("rs")]
    public decimal Rs { get; set; }

    [JsonPropertyName("nir")]
    public decimal Nir { get; set; }

    [JsonPropertyName("es")]
    public decimal Es { get; set; }

    [JsonPropertyName("rule_triggered")]
    public string RuleTriggered { get; set; } = string.Empty;

    [JsonPropertyName("action")]
    public string Action { get; set; } = string.Empty;

    [JsonPropertyName("transfer_quantity")]
    public decimal TransferQuantity { get; set; }

    [JsonPropertyName("procurement_quantity")]
    public decimal ProcurementQuantity { get; set; }

    [JsonPropertyName("explanation")]
    public string Explanation { get; set; } = string.Empty;

    [JsonPropertyName("status")]
    public string Status { get; set; } = "Pending Management Approval";

    [JsonPropertyName("transfers")]
    public List<RbdssTransferDto> Transfers { get; set; } = [];
}

public class RbdssTransferDto
{
    [JsonPropertyName("donor_branch_id")]
    public string DonorBranchId { get; set; } = string.Empty;

    [JsonPropertyName("donor_branch_name")]
    public string? DonorBranchName { get; set; }

    [JsonPropertyName("recipient_branch_id")]
    public string RecipientBranchId { get; set; } = string.Empty;

    [JsonPropertyName("recipient_branch_name")]
    public string? RecipientBranchName { get; set; }

    [JsonPropertyName("product_id")]
    public string ProductId { get; set; } = string.Empty;

    [JsonPropertyName("product_sku")]
    public string? ProductSku { get; set; }

    [JsonPropertyName("product_name")]
    public string? ProductName { get; set; }

    [JsonPropertyName("period")]
    public string Period { get; set; } = string.Empty;

    [JsonPropertyName("transfer_quantity")]
    public decimal TransferQuantity { get; set; }
}

public class RbdssProcurementDto
{
    [JsonPropertyName("product_id")]
    public string ProductId { get; set; } = string.Empty;

    [JsonPropertyName("product_sku")]
    public string? ProductSku { get; set; }

    [JsonPropertyName("product_name")]
    public string? ProductName { get; set; }

    [JsonPropertyName("period")]
    public string Period { get; set; } = string.Empty;

    [JsonPropertyName("total_procurement_quantity")]
    public decimal TotalProcurementQuantity { get; set; }

    [JsonPropertyName("branch_breakdown")]
    public List<RbdssProcurementBranchBreakdownDto> BranchBreakdown { get; set; } = [];
}

public class RbdssProcurementBranchBreakdownDto
{
    [JsonPropertyName("branch_id")]
    public string BranchId { get; set; } = string.Empty;

    [JsonPropertyName("branch_name")]
    public string? BranchName { get; set; }

    [JsonPropertyName("procurement_quantity")]
    public decimal ProcurementQuantity { get; set; }
}

public class RbdssAllocationDto
{
    [JsonPropertyName("branch_id")]
    public string BranchId { get; set; } = string.Empty;

    [JsonPropertyName("branch_name")]
    public string? BranchName { get; set; }

    [JsonPropertyName("product_id")]
    public string ProductId { get; set; } = string.Empty;

    [JsonPropertyName("product_sku")]
    public string? ProductSku { get; set; }

    [JsonPropertyName("product_name")]
    public string? ProductName { get; set; }

    [JsonPropertyName("period")]
    public string Period { get; set; } = string.Empty;

    [JsonPropertyName("pas")]
    public decimal Pas { get; set; }

    [JsonPropertyName("rs")]
    public decimal Rs { get; set; }

    [JsonPropertyName("net_transfers")]
    public decimal NetTransfers { get; set; }

    [JsonPropertyName("procurement")]
    public decimal Procurement { get; set; }

    [JsonPropertyName("projected_closing_stock")]
    public decimal ProjectedClosingStock { get; set; }

    [JsonPropertyName("inventory_posture")]
    public string InventoryPosture { get; set; } = string.Empty;
}


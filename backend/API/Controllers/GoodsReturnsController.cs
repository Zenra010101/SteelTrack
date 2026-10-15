using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace SteelTrack.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GoodsReturnsController : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult GetReturns([FromQuery] string? branch)
    {
        var sampleReturns = new List<object>
        {
            new
            {
                Id = Guid.NewGuid(),
                GrsNumber = "GRS-2026-0104",
                InvoiceNumber = "INV-2026-0041",
                CustomerName = "Mindanao Steelworks Corp.",
                Branch = "Davao",
                Status = "Pending_Approval",
                TotalReturnValuePHP = 127500m,
                RequestedBy = "Juan Dela Cruz (Cashier)",
                CreatedAt = DateTime.UtcNow.AddDays(-2),
                Items = new List<object>
                {
                    new
                    {
                        HeatNumber = "HT-2026-8841",
                        Grade = "A36_Structural",
                        QuantityReturnedTons = 1.5m,
                        UnitPricePerTonPHP = 85000m,
                        SubtotalPHP = 127500m,
                        Reason = "Quality_Defect_Rust",
                        RestockEligible = false
                    }
                }
            }
        };

        return Ok(sampleReturns);
    }

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public IActionResult CreateReturn([FromBody] CreateGrsRequest request)
    {
        if (request.Items == null || request.Items.Count == 0)
        {
            return BadRequest(new { message = "At least one item must be included in the return slip." });
        }

        var newGrsId = Guid.NewGuid();
        var grsNumber = $"GRS-{DateTime.UtcNow.Year}-{Random.Shared.Next(1000, 9999)}";

        return CreatedAtAction(nameof(GetReturns), new { id = newGrsId }, new
        {
            Id = newGrsId,
            GrsNumber = grsNumber,
            InvoiceNumber = request.InvoiceNumber,
            CustomerName = request.CustomerName,
            Branch = request.Branch,
            Status = "Pending_Approval",
            CreatedAt = DateTime.UtcNow
        });
    }

    [HttpPost("{id:guid}/approve")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult ApproveReturn(Guid id, [FromBody] ApproveReturnRequest request)
    {
        var creditNoteNum = $"CN-{DateTime.UtcNow.Year}-{Random.Shared.Next(1000, 9999)}";

        return Ok(new
        {
            Message = "Goods Return Slip approved successfully.",
            GrsId = id,
            Status = "Approved",
            CreditNoteNumber = creditNoteNum,
            ApprovedBy = request.ApproverName,
            ApprovedAt = DateTime.UtcNow
        });
    }

    [HttpPost("{id:guid}/reject")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult RejectReturn(Guid id, [FromBody] RejectReturnRequest request)
    {
        return Ok(new
        {
            Message = "Goods Return Slip rejected.",
            GrsId = id,
            Status = "Rejected",
            RejectedBy = request.RejecterName,
            RejectionReason = request.RejectionReason,
            RejectedAt = DateTime.UtcNow
        });
    }

    [HttpGet("lookup-heat/{heatNumber}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult LookupHeat(string heatNumber)
    {
        var clean = heatNumber.Trim();
        // Return matching sold heat specifications
        return Ok(new
        {
            HeatNumber = clean,
            InvoiceNumber = "INV-2026-0041",
            CustomerName = "Mindanao Steelworks Corp.",
            Grade = "A36_Structural",
            Dimensions = "12mm x 1500mm x 6000mm",
            PurchasedQtyTons = 5.0m,
            PurchasedQtyPieces = 25,
            UnitPricePerTonPHP = 85000m,
            MaxReturnableTons = 5.0m
        });
    }
}

public class CreateGrsRequest
{
    public string InvoiceNumber { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string Branch { get; set; } = "Davao";
    public string RequestedBy { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public List<GrsItemRequest> Items { get; set; } = new();
}

public class GrsItemRequest
{
    public string BatchId { get; set; } = string.Empty;
    public string HeatNumber { get; set; } = string.Empty;
    public string Grade { get; set; } = string.Empty;
    public string Dimensions { get; set; } = string.Empty;
    public decimal QuantityReturnedTons { get; set; }
    public decimal UnitPricePerTonPHP { get; set; }
    public string Reason { get; set; } = "Damaged_In_Transit";
    public bool RestockEligible { get; set; }
}

public class ApproveReturnRequest
{
    public string ApproverName { get; set; } = string.Empty;
}

public class RejectReturnRequest
{
    public string RejecterName { get; set; } = string.Empty;
    public string RejectionReason { get; set; } = string.Empty;
}

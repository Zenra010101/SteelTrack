using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using SteelTrack.Domain.Entities;
using SteelTrack.Domain.Enums;

namespace SteelTrack.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReceivablesController : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult GetReceivables([FromQuery] string? branch)
    {
        // Sample Clean Architecture API response contract
        var sampleData = new List<object>
        {
            new
            {
                Id = Guid.NewGuid(),
                CustomerName = "Mindanao Steelworks Corp.",
                CompanyName = "Mindanao Steelworks Corporation",
                Tin = "241-890-112-000",
                CreditLimitPHP = 5000000m,
                TotalOutstandingPHP = 1450000m,
                CurrentBalancePHP = 850000m,
                Days30BalancePHP = 400000m,
                Days60BalancePHP = 200000m,
                Days90PlusBalancePHP = 0m,
                Status = "GoodStanding",
                Branch = "Davao"
            },
            new
            {
                Id = Guid.NewGuid(),
                CustomerName = "Apex Industrial Builders",
                CompanyName = "Apex Construction & Industrial Inc.",
                Tin = "109-443-887-001",
                CreditLimitPHP = 3000000m,
                TotalOutstandingPHP = 2850000m,
                CurrentBalancePHP = 600000m,
                Days30BalancePHP = 950000m,
                Days60BalancePHP = 800000m,
                Days90PlusBalancePHP = 500000m,
                Status = "CreditWarning",
                Branch = "Cagayan"
            }
        };

        return Ok(sampleData);
    }

    [HttpPost("{id:guid}/pay")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public IActionResult RecordPayment(Guid id, [FromBody] RecordPaymentRequest request)
    {
        if (request.AmountPaidPHP <= 0)
        {
            return BadRequest(new { message = "Payment amount must be greater than zero." });
        }

        return Ok(new
        {
            Message = "Payment recorded successfully",
            ReceivableId = id,
            AmountPaid = request.AmountPaidPHP,
            PaymentMethod = request.PaymentMethod,
            ProcessedAt = DateTime.UtcNow
        });
    }

    [HttpGet("stats")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult GetStats([FromQuery] string? branch)
    {
        return Ok(new
        {
            TotalReceivablesPHP = 9420000m,
            TotalCurrentPHP = 3070000m,
            TotalOverduePHP = 6350000m,
            PendingPdcAmountPHP = 2050000m,
            PendingPdcCount = 4,
            BouncedCount = 1
        });
    }
}

public class RecordPaymentRequest
{
    public decimal AmountPaidPHP { get; set; }
    public string PaymentMethod { get; set; } = "Cash";
    public string? ReferenceNumber { get; set; }
    public string? ChequeNumber { get; set; }
    public string? BankName { get; set; }
    public DateTime? ChequeDate { get; set; }
    public string? Notes { get; set; }
    public string ProcessedBy { get; set; } = string.Empty;
}

using SteelTrack.Domain.Enums;

namespace SteelTrack.Domain.Entities;

public class Sale
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string SaleNumber { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public User User { get; set; } = null!;
    public decimal SubTotal { get; set; } = 0m;
    public decimal DiscountPercent { get; set; } = 0m;
    public decimal DiscountAmount { get; set; } = 0m;
    public TaxMode TaxMode { get; set; } = TaxMode.Inclusive;
    public string? TaxTypeLabel { get; set; }
    public decimal TaxRate { get; set; } = 0m;
    public decimal TaxAmount { get; set; } = 0m;
    public decimal WithholdingAmount { get; set; } = 0m;
    public string? ManualTaxName { get; set; }
    public bool ManualTaxIsPercent { get; set; } = false;
    public decimal ManualTaxValue { get; set; } = 0m;
    public bool ManualTaxIsDeduction { get; set; } = false;
    public decimal TotalAmount { get; set; } = 0m;
    public decimal GrossProfit { get; set; } = 0m;
    public decimal AmountPaid { get; set; } = 0m;
    public decimal ChangeAmount { get; set; } = 0m;
    public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.Cash;
    public int Status { get; set; } = 0;
    public bool IsArchived { get; set; } = false;
    public string? CustomerName { get; set; }
    public string? CustomerId { get; set; }
    public Customer? Customer { get; set; }
    public string? Notes { get; set; }
    public string? VoidReason { get; set; }
    public DateTime? VoidedAt { get; set; }
    public string? VoidedByUserId { get; set; }
    public User? VoidedByUser { get; set; }
    public string? ReplacesSaleId { get; set; }
    public Sale? ReplacesSale { get; set; }
    public string? ReplacedBySaleId { get; set; }
    public Sale? ReplacedBySale { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public ICollection<SaleItem> Items { get; set; } = new List<SaleItem>();
    public ICollection<SalePayment> Payments { get; set; } = new List<SalePayment>();
    public ICollection<SaleCheque> Cheques { get; set; } = new List<SaleCheque>();
    public ICollection<GoodsReturnSlip> ReturnSlips { get; set; } = new List<GoodsReturnSlip>();
    public CustomerReceivable? CustomerReceivable { get; set; }
}

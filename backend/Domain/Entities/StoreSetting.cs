namespace SteelTrack.Domain.Entities;

public class StoreSetting
{
    public int Id { get; set; } = 1;
    public bool VatEnabled { get; set; } = true;
    public decimal VatRate { get; set; } = 12.00m;
    public bool PricesIncludeVat { get; set; } = true;
    public string OutletLine { get; set; } = string.Empty;
    public string BrandLine { get; set; } = string.Empty;
    public string Tagline { get; set; } = string.Empty;
    public string StoreName { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string TrustReceiptTitle { get; set; } = string.Empty;
    public string CashReceiptTitle { get; set; } = string.Empty;
    public bool AllowCashierBarcodePrinting { get; set; } = false;
}

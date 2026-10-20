using System.Reflection;
using Microsoft.EntityFrameworkCore;
using SteelTrack.Domain.Entities;

namespace SteelTrack.Infrastructure.Persistence;

public class SteelTrackDbContext : DbContext
{
    public SteelTrackDbContext(DbContextOptions<SteelTrackDbContext> options) : base(options)
    {
    }

    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<Branch> Branches => Set<Branch>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<StoreSetting> StoreSettings => Set<StoreSetting>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<SupplierContact> SupplierContacts => Set<SupplierContact>();
    public DbSet<SupplierAttachment> SupplierAttachments => Set<SupplierAttachment>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductBatch> ProductBatches => Set<ProductBatch>();
    public DbSet<User> Users => Set<User>();
    public DbSet<UserBranchAccess> UserBranchAccesses => Set<UserBranchAccess>();
    public DbSet<InventoryAdjustmentRequest> InventoryAdjustmentRequests => Set<InventoryAdjustmentRequest>();
    public DbSet<InventoryAdjustmentRequestLine> InventoryAdjustmentRequestLines => Set<InventoryAdjustmentRequestLine>();
    public DbSet<Sale> Sales => Set<Sale>();
    public DbSet<SaleItem> SaleItems => Set<SaleItem>();
    public DbSet<SalePayment> SalePayments => Set<SalePayment>();
    public DbSet<SaleCheque> SaleCheques => Set<SaleCheque>();
    public DbSet<CustomerReceivable> CustomerReceivables => Set<CustomerReceivable>();
    public DbSet<ReceivablePayment> ReceivablePayments => Set<ReceivablePayment>();
    public DbSet<GoodsReturnSlip> GoodsReturnSlips => Set<GoodsReturnSlip>();
    public DbSet<GoodsReturnSlipItem> GoodsReturnSlipItems => Set<GoodsReturnSlipItem>();
    public DbSet<SalesReturnDeduction> SalesReturnDeductions => Set<SalesReturnDeduction>();
    public DbSet<BouncedChequeHistory> BouncedChequeHistories => Set<BouncedChequeHistory>();
    public DbSet<StockReceiving> StockReceivings => Set<StockReceiving>();
    public DbSet<StockReceivingItem> StockReceivingItems => Set<StockReceivingItem>();
    public DbSet<StockReceivingAttachment> StockReceivingAttachments => Set<StockReceivingAttachment>();
    public DbSet<InventoryTransaction> InventoryTransactions => Set<InventoryTransaction>();
    public DbSet<GoodsExchange> GoodsExchanges => Set<GoodsExchange>();
    public DbSet<GoodsExchangeLine> GoodsExchangeLines => Set<GoodsExchangeLine>();
    public DbSet<SalesReportVerification> SalesReportVerifications => Set<SalesReportVerification>();
    public DbSet<SteelBatch> SteelBatches => Set<SteelBatch>();
    public DbSet<StockTransfer> StockTransfers => Set<StockTransfer>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(Assembly.GetExecutingAssembly());

        var guidConverter = new Microsoft.EntityFrameworkCore.Storage.ValueConversion.StringToGuidConverter();

        // Global Convention: Map ID and Foreign Key strings to PostgreSQL 'uuid', and others to 'varchar'
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (entityType.ClrType == typeof(SteelBatch)) continue;

            foreach (var property in entityType.GetProperties())
            {
                if (property.ClrType == typeof(string))
                {
                    if (property.Name == "Id" || (property.Name.EndsWith("Id") && property.Name != "TimeZoneId" && property.Name != "TaxId"))
                    {
                        property.SetValueConverter(guidConverter);
                        property.SetColumnType("uuid");
                    }
                    else
                    {
                        var maxLength = property.GetMaxLength();
                        if (maxLength.HasValue)
                        {
                            property.SetColumnType($"varchar({maxLength.Value})");
                        }
                        else
                        {
                            property.SetColumnType("varchar");
                        }
                    }
                }
            }
        }

        // Legacy prototype fallback mapping
        modelBuilder.Entity<SteelBatch>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.HeatNumber).IsRequired().HasMaxLength(50);
            entity.Property(e => e.Grade).HasConversion<string>();
            entity.Property(e => e.Status).HasConversion<string>();
            entity.Property(e => e.Dimensions).HasMaxLength(100);
            entity.Property(e => e.Location).HasMaxLength(100);
        });
    }
}

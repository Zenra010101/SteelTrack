using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace SteelTrack.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialDataDictionarySchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AuditLogs",
                columns: table => new
                {
                    Id = table.Column<string>(type: "varchar", nullable: false),
                    UserId = table.Column<string>(type: "varchar", nullable: true),
                    UserEmail = table.Column<string>(type: "varchar", nullable: true),
                    Action = table.Column<string>(type: "varchar", nullable: false),
                    EntityType = table.Column<string>(type: "varchar", nullable: false),
                    EntityId = table.Column<string>(type: "varchar", nullable: true),
                    Details = table.Column<string>(type: "varchar", nullable: true),
                    IpAddress = table.Column<string>(type: "varchar", nullable: true),
                    IsArchived = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Category = table.Column<int>(type: "integer", nullable: false),
                    UserAgent = table.Column<string>(type: "varchar", nullable: true),
                    Status = table.Column<string>(type: "varchar", nullable: true),
                    OldValue = table.Column<string>(type: "varchar", nullable: true),
                    NewValue = table.Column<string>(type: "varchar", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Categories",
                columns: table => new
                {
                    Id = table.Column<string>(type: "varchar(36)", maxLength: 36, nullable: false),
                    Name = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false),
                    Description = table.Column<string>(type: "varchar", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Icon = table.Column<string>(type: "varchar", nullable: true),
                    ColorAccent = table.Column<string>(type: "varchar", nullable: true),
                    ParentCategoryId = table.Column<string>(type: "varchar", nullable: true),
                    CreatedByUserId = table.Column<string>(type: "varchar", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Categories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Categories_Categories_ParentCategoryId",
                        column: x => x.ParentCategoryId,
                        principalTable: "Categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Customers",
                columns: table => new
                {
                    Id = table.Column<string>(type: "varchar", nullable: false),
                    Name = table.Column<string>(type: "varchar", nullable: false),
                    Phone = table.Column<string>(type: "varchar", nullable: true),
                    Email = table.Column<string>(type: "varchar", nullable: true),
                    Address = table.Column<string>(type: "varchar", nullable: true),
                    Notes = table.Column<string>(type: "varchar", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CustomerType = table.Column<int>(type: "integer", nullable: false),
                    CreditLimit = table.Column<decimal>(type: "numeric", nullable: false),
                    IsBlacklisted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "varchar", nullable: true),
                    CustomerCode = table.Column<string>(type: "varchar", nullable: true),
                    EnableCredit = table.Column<bool>(type: "boolean", nullable: false),
                    PaymentTerms = table.Column<int>(type: "integer", nullable: false),
                    DueDays = table.Column<int>(type: "integer", nullable: false),
                    CustomPaymentTerms = table.Column<string>(type: "varchar", nullable: true),
                    AllowCheque = table.Column<bool>(type: "boolean", nullable: false),
                    IsBlocked = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Customers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Roles",
                columns: table => new
                {
                    Id = table.Column<string>(type: "varchar(36)", maxLength: 36, nullable: false),
                    Name = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Roles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SalesReportVerifications",
                columns: table => new
                {
                    Id = table.Column<string>(type: "varchar", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReportCode = table.Column<string>(type: "varchar", nullable: false),
                    Preset = table.Column<string>(type: "varchar", nullable: false),
                    PeriodLabel = table.Column<string>(type: "varchar", nullable: false),
                    FromDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ToDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    GrossSales = table.Column<decimal>(type: "numeric", nullable: false),
                    NetSales = table.Column<decimal>(type: "numeric", nullable: false),
                    TotalLineAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    PrintedAtLabel = table.Column<string>(type: "varchar", nullable: false),
                    PrintedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    StoreName = table.Column<string>(type: "varchar", nullable: true),
                    GeneratedByUserId = table.Column<string>(type: "varchar", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalesReportVerifications", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SteelBatches",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    HeatNumber = table.Column<string>(type: "varchar", maxLength: 50, nullable: false),
                    Grade = table.Column<string>(type: "text", nullable: false),
                    WeightInTons = table.Column<double>(type: "double precision", nullable: false),
                    Dimensions = table.Column<string>(type: "varchar", maxLength: 100, nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    Location = table.Column<string>(type: "varchar", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdated = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SteelBatches", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "StoreSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    VatEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    VatRate = table.Column<decimal>(type: "numeric", nullable: false),
                    PricesIncludeVat = table.Column<bool>(type: "boolean", nullable: false),
                    OutletLine = table.Column<string>(type: "varchar", nullable: false),
                    BrandLine = table.Column<string>(type: "varchar", nullable: false),
                    Tagline = table.Column<string>(type: "varchar", nullable: false),
                    StoreName = table.Column<string>(type: "varchar", nullable: false),
                    Address = table.Column<string>(type: "varchar", nullable: false),
                    Phone = table.Column<string>(type: "varchar", nullable: false),
                    TrustReceiptTitle = table.Column<string>(type: "varchar", nullable: false),
                    CashReceiptTitle = table.Column<string>(type: "varchar", nullable: false),
                    AllowCashierBarcodePrinting = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StoreSettings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Suppliers",
                columns: table => new
                {
                    Id = table.Column<string>(type: "varchar", nullable: false),
                    Name = table.Column<string>(type: "varchar", nullable: false),
                    ContactPerson = table.Column<string>(type: "varchar", nullable: true),
                    Phone = table.Column<string>(type: "varchar", nullable: true),
                    Email = table.Column<string>(type: "varchar", nullable: true),
                    Address = table.Column<string>(type: "varchar", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PaymentTerms = table.Column<int>(type: "integer", nullable: false),
                    CustomPaymentTerms = table.Column<string>(type: "varchar", nullable: true),
                    Notes = table.Column<string>(type: "varchar", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "varchar", nullable: true),
                    SupplierCode = table.Column<string>(type: "varchar", nullable: true),
                    DeliveryNotes = table.Column<string>(type: "varchar", nullable: true),
                    SupplierRemarks = table.Column<string>(type: "varchar", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Suppliers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<string>(type: "varchar(36)", maxLength: 36, nullable: false),
                    Email = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false),
                    FullName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false),
                    PasswordHash = table.Column<string>(type: "varchar", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    RoleId = table.Column<string>(type: "varchar", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Users_Roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Products",
                columns: table => new
                {
                    Id = table.Column<string>(type: "varchar(36)", maxLength: 36, nullable: false),
                    Sku = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false),
                    Name = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false),
                    Description = table.Column<string>(type: "varchar", nullable: true),
                    Barcode = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                    Size = table.Column<string>(type: "varchar", nullable: true),
                    Thickness = table.Column<string>(type: "varchar", nullable: true),
                    Length = table.Column<string>(type: "varchar", nullable: true),
                    Grade = table.Column<string>(type: "varchar", nullable: true),
                    UnitOfMeasure = table.Column<string>(type: "varchar", nullable: false),
                    UnitPrice = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    CostPrice = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    StockQuantity = table.Column<int>(type: "integer", nullable: false),
                    ReorderLevel = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CategoryId = table.Column<string>(type: "varchar", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Diameter = table.Column<string>(type: "varchar", nullable: true),
                    Schedule = table.Column<string>(type: "varchar", nullable: true),
                    Width = table.Column<string>(type: "varchar", nullable: true),
                    Height = table.Column<string>(type: "varchar", nullable: true),
                    MaterialType = table.Column<string>(type: "varchar", nullable: true),
                    SupplierId = table.Column<string>(type: "varchar", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Products", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Products_Categories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "Categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Products_Suppliers_SupplierId",
                        column: x => x.SupplierId,
                        principalTable: "Suppliers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "SupplierAttachments",
                columns: table => new
                {
                    Id = table.Column<string>(type: "varchar", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SupplierId = table.Column<string>(type: "varchar", nullable: false),
                    FileName = table.Column<string>(type: "varchar", nullable: false),
                    StoredFileName = table.Column<string>(type: "varchar", nullable: false),
                    ContentType = table.Column<string>(type: "varchar", nullable: false),
                    FileSizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    Description = table.Column<string>(type: "varchar", nullable: true),
                    UploadedByUserId = table.Column<string>(type: "varchar", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SupplierAttachments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SupplierAttachments_Suppliers_SupplierId",
                        column: x => x.SupplierId,
                        principalTable: "Suppliers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SupplierContacts",
                columns: table => new
                {
                    Id = table.Column<string>(type: "varchar", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SupplierId = table.Column<string>(type: "varchar", nullable: false),
                    Name = table.Column<string>(type: "varchar", nullable: false),
                    Role = table.Column<int>(type: "integer", nullable: false),
                    Phone = table.Column<string>(type: "varchar", nullable: true),
                    Email = table.Column<string>(type: "varchar", nullable: true),
                    IsPrimary = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SupplierContacts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SupplierContacts_Suppliers_SupplierId",
                        column: x => x.SupplierId,
                        principalTable: "Suppliers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Sales",
                columns: table => new
                {
                    Id = table.Column<string>(type: "varchar(36)", maxLength: 36, nullable: false),
                    SaleNumber = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false),
                    UserId = table.Column<string>(type: "varchar", nullable: false),
                    SubTotal = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    DiscountPercent = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    DiscountAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    TaxMode = table.Column<int>(type: "integer", nullable: false),
                    TaxTypeLabel = table.Column<string>(type: "varchar", nullable: true),
                    TaxRate = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    TaxAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    WithholdingAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    ManualTaxName = table.Column<string>(type: "varchar", nullable: true),
                    ManualTaxIsPercent = table.Column<bool>(type: "boolean", nullable: false),
                    ManualTaxValue = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    ManualTaxIsDeduction = table.Column<bool>(type: "boolean", nullable: false),
                    TotalAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    GrossProfit = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    AmountPaid = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    ChangeAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    PaymentMethod = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    IsArchived = table.Column<bool>(type: "boolean", nullable: false),
                    CustomerName = table.Column<string>(type: "varchar", nullable: true),
                    CustomerId = table.Column<string>(type: "varchar", nullable: true),
                    Notes = table.Column<string>(type: "varchar", nullable: true),
                    VoidReason = table.Column<string>(type: "varchar", nullable: true),
                    VoidedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    VoidedByUserId = table.Column<string>(type: "varchar", nullable: true),
                    ReplacesSaleId = table.Column<string>(type: "varchar", nullable: true),
                    ReplacedBySaleId = table.Column<string>(type: "varchar", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sales", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Sales_Customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "Customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Sales_Sales_ReplacedBySaleId",
                        column: x => x.ReplacedBySaleId,
                        principalTable: "Sales",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Sales_Sales_ReplacesSaleId",
                        column: x => x.ReplacesSaleId,
                        principalTable: "Sales",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Sales_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Sales_Users_VoidedByUserId",
                        column: x => x.VoidedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "StockReceivings",
                columns: table => new
                {
                    Id = table.Column<string>(type: "varchar(36)", maxLength: 36, nullable: false),
                    ReceivingNumber = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false),
                    SupplierId = table.Column<string>(type: "varchar", nullable: false),
                    ContainerNumber = table.Column<string>(type: "varchar", nullable: false),
                    StockNumber = table.Column<string>(type: "varchar", nullable: false),
                    ReferenceNumber = table.Column<string>(type: "varchar", nullable: false),
                    DeliveryDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    IsArchived = table.Column<bool>(type: "boolean", nullable: false),
                    Notes = table.Column<string>(type: "varchar", nullable: true),
                    RequestedByUserId = table.Column<string>(type: "varchar", nullable: false),
                    ReviewedByUserId = table.Column<string>(type: "varchar", nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectionReason = table.Column<string>(type: "varchar", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeliveryReceiptNumber = table.Column<string>(type: "varchar", nullable: true),
                    ApprovalNotes = table.Column<string>(type: "varchar", nullable: true),
                    PurchaseOrderId = table.Column<string>(type: "varchar", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StockReceivings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StockReceivings_Suppliers_SupplierId",
                        column: x => x.SupplierId,
                        principalTable: "Suppliers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StockReceivings_Users_RequestedByUserId",
                        column: x => x.RequestedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StockReceivings_Users_ReviewedByUserId",
                        column: x => x.ReviewedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "InventoryAdjustmentRequests",
                columns: table => new
                {
                    Id = table.Column<string>(type: "varchar(36)", maxLength: 36, nullable: false),
                    ProductId = table.Column<string>(type: "varchar", nullable: false),
                    SystemQuantity = table.Column<int>(type: "integer", nullable: false),
                    ActualQuantity = table.Column<int>(type: "integer", nullable: false),
                    Difference = table.Column<int>(type: "integer", nullable: false),
                    Reason = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    RequestedByUserId = table.Column<string>(type: "varchar", nullable: false),
                    ReviewedByUserId = table.Column<string>(type: "varchar", nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectionReason = table.Column<string>(type: "varchar", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AdjustmentType = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "varchar", nullable: true),
                    ApprovalNotes = table.Column<string>(type: "varchar", nullable: true),
                    CountingSessionId = table.Column<string>(type: "varchar", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InventoryAdjustmentRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InventoryAdjustmentRequests_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InventoryAdjustmentRequests_Users_RequestedByUserId",
                        column: x => x.RequestedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InventoryAdjustmentRequests_Users_ReviewedByUserId",
                        column: x => x.ReviewedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CustomerReceivables",
                columns: table => new
                {
                    Id = table.Column<string>(type: "varchar(36)", maxLength: 36, nullable: false),
                    SaleId = table.Column<string>(type: "varchar", nullable: false),
                    CustomerId = table.Column<string>(type: "varchar", nullable: true),
                    CustomerName = table.Column<string>(type: "varchar", nullable: false),
                    TotalAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    PaidAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    RemainingBalance = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    DueDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "varchar", nullable: true),
                    IsArchived = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CustomerReceivables", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CustomerReceivables_Customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "Customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CustomerReceivables_Sales_SaleId",
                        column: x => x.SaleId,
                        principalTable: "Sales",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "GoodsReturnSlips",
                columns: table => new
                {
                    Id = table.Column<string>(type: "varchar(36)", maxLength: 36, nullable: false),
                    GrsNumber = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false),
                    OriginalSaleId = table.Column<string>(type: "varchar", nullable: false),
                    ProcessedByUserId = table.Column<string>(type: "varchar", nullable: false),
                    ReturnDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    TotalReturnAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    Reason = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: false),
                    GoodConditionConfirmed = table.Column<bool>(type: "boolean", nullable: false),
                    Notes = table.Column<string>(type: "varchar", nullable: true),
                    IsArchived = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    OriginalInvoiceNumber = table.Column<string>(type: "varchar", nullable: true),
                    CustomerName = table.Column<string>(type: "varchar", nullable: true),
                    OriginalSaleDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RefundMethod = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    VoidedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    VoidedByUserId = table.Column<string>(type: "varchar", nullable: true),
                    VoidReason = table.Column<string>(type: "varchar", nullable: true),
                    WorkflowKind = table.Column<int>(type: "integer", nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SubmittedByUserId = table.Column<string>(type: "varchar", nullable: true),
                    ApprovedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApprovedByUserId = table.Column<string>(type: "varchar", nullable: true),
                    ApprovalNotes = table.Column<string>(type: "varchar", nullable: true),
                    RejectedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectedByUserId = table.Column<string>(type: "varchar", nullable: true),
                    RejectionReason = table.Column<string>(type: "varchar", nullable: true),
                    StockRestoredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    GoodsExchangeId = table.Column<string>(type: "varchar", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GoodsReturnSlips", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GoodsReturnSlips_Sales_OriginalSaleId",
                        column: x => x.OriginalSaleId,
                        principalTable: "Sales",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_GoodsReturnSlips_Users_ProcessedByUserId",
                        column: x => x.ProcessedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_GoodsReturnSlips_Users_VoidedByUserId",
                        column: x => x.VoidedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SaleCheques",
                columns: table => new
                {
                    Id = table.Column<string>(type: "varchar", nullable: false),
                    SaleId = table.Column<string>(type: "varchar", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    BankName = table.Column<string>(type: "varchar", nullable: false),
                    Branch = table.Column<string>(type: "varchar", nullable: true),
                    ChequeNumber = table.Column<string>(type: "varchar", nullable: false),
                    AccountName = table.Column<string>(type: "varchar", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric", nullable: false),
                    MaturityDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ClearedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    BouncedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Notes = table.Column<string>(type: "varchar", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    BounceReason = table.Column<string>(type: "varchar", nullable: true),
                    CustomerReceivableId = table.Column<string>(type: "varchar", nullable: true),
                    ClearedReceivablePaymentId = table.Column<string>(type: "varchar", nullable: true),
                    ReceivablePaymentId = table.Column<string>(type: "varchar", nullable: true),
                    ProcessedByUserId = table.Column<string>(type: "varchar", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SaleCheques", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SaleCheques_Sales_SaleId",
                        column: x => x.SaleId,
                        principalTable: "Sales",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SalePayments",
                columns: table => new
                {
                    Id = table.Column<string>(type: "varchar", nullable: false),
                    SaleId = table.Column<string>(type: "varchar", nullable: false),
                    Method = table.Column<int>(type: "integer", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric", nullable: false),
                    QrphReference = table.Column<string>(type: "varchar", nullable: true),
                    BankName = table.Column<string>(type: "varchar", nullable: true),
                    BankReferenceNumber = table.Column<string>(type: "varchar", nullable: true),
                    SenderName = table.Column<string>(type: "varchar", nullable: true),
                    DatePaid = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    BankBranch = table.Column<string>(type: "varchar", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalePayments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SalePayments_Sales_SaleId",
                        column: x => x.SaleId,
                        principalTable: "Sales",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "InventoryTransactions",
                columns: table => new
                {
                    Id = table.Column<string>(type: "varchar(36)", maxLength: 36, nullable: false),
                    ProductId = table.Column<string>(type: "varchar", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    StockBefore = table.Column<int>(type: "integer", nullable: false),
                    StockAfter = table.Column<int>(type: "integer", nullable: false),
                    Reference = table.Column<string>(type: "varchar", nullable: true),
                    Notes = table.Column<string>(type: "varchar", nullable: true),
                    StockReceivingId = table.Column<string>(type: "varchar", nullable: true),
                    UserId = table.Column<string>(type: "varchar", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ProductBatchId = table.Column<string>(type: "varchar", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InventoryTransactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InventoryTransactions_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InventoryTransactions_StockReceivings_StockReceivingId",
                        column: x => x.StockReceivingId,
                        principalTable: "StockReceivings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_InventoryTransactions_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "ProductBatches",
                columns: table => new
                {
                    Id = table.Column<string>(type: "varchar(36)", maxLength: 36, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ProductId = table.Column<string>(type: "varchar", nullable: false),
                    BatchCode = table.Column<string>(type: "varchar", nullable: true),
                    CostPrice = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    SellingPrice = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    ReceivedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    StockReceivingId = table.Column<string>(type: "varchar", nullable: true),
                    ReceivedQuantity = table.Column<int>(type: "integer", nullable: false),
                    StockReceivingItemId = table.Column<string>(type: "varchar", nullable: true),
                    SupplierId = table.Column<string>(type: "varchar", nullable: true),
                    ReceivedByUserId = table.Column<string>(type: "varchar", nullable: true),
                    ApprovedByUserId = table.Column<string>(type: "varchar", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductBatches", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductBatches_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProductBatches_StockReceivings_StockReceivingId",
                        column: x => x.StockReceivingId,
                        principalTable: "StockReceivings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_ProductBatches_Suppliers_SupplierId",
                        column: x => x.SupplierId,
                        principalTable: "Suppliers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "StockReceivingAttachments",
                columns: table => new
                {
                    Id = table.Column<string>(type: "varchar", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    StockReceivingId = table.Column<string>(type: "varchar", nullable: false),
                    FileName = table.Column<string>(type: "varchar", nullable: false),
                    StoredFileName = table.Column<string>(type: "varchar", nullable: false),
                    ContentType = table.Column<string>(type: "varchar", nullable: false),
                    FileSizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    Description = table.Column<string>(type: "varchar", nullable: true),
                    UploadedByUserId = table.Column<string>(type: "varchar", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StockReceivingAttachments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StockReceivingAttachments_StockReceivings_StockReceivingId",
                        column: x => x.StockReceivingId,
                        principalTable: "StockReceivings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "StockReceivingItems",
                columns: table => new
                {
                    Id = table.Column<string>(type: "varchar(36)", maxLength: 36, nullable: false),
                    StockReceivingId = table.Column<string>(type: "varchar", nullable: false),
                    ProductId = table.Column<string>(type: "varchar", nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "varchar", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ExpectedQuantity = table.Column<int>(type: "integer", nullable: true),
                    CostPrice = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    Remarks = table.Column<string>(type: "varchar", nullable: true),
                    SellingPrice = table.Column<decimal>(type: "numeric(18,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StockReceivingItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StockReceivingItems_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StockReceivingItems_StockReceivings_StockReceivingId",
                        column: x => x.StockReceivingId,
                        principalTable: "StockReceivings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "GoodsExchanges",
                columns: table => new
                {
                    Id = table.Column<string>(type: "varchar(36)", maxLength: 36, nullable: false),
                    GoodsReturnSlipId = table.Column<string>(type: "varchar", nullable: false),
                    ExchangeNumber = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false),
                    ReturnCreditTotal = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    ReplacementTotal = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    AmountPaid = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    PaymentMethod = table.Column<int>(type: "integer", nullable: true),
                    TopUpSaleId = table.Column<string>(type: "varchar", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CompletedByUserId = table.Column<string>(type: "varchar", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GoodsExchanges", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GoodsExchanges_GoodsReturnSlips_GoodsReturnSlipId",
                        column: x => x.GoodsReturnSlipId,
                        principalTable: "GoodsReturnSlips",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_GoodsExchanges_Sales_TopUpSaleId",
                        column: x => x.TopUpSaleId,
                        principalTable: "Sales",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_GoodsExchanges_Users_CompletedByUserId",
                        column: x => x.CompletedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ReceivablePayments",
                columns: table => new
                {
                    Id = table.Column<string>(type: "varchar(36)", maxLength: 36, nullable: false),
                    CustomerReceivableId = table.Column<string>(type: "varchar", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    BalanceBefore = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    BalanceAfter = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    PaymentDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Reference = table.Column<string>(type: "varchar", nullable: true),
                    Notes = table.Column<string>(type: "varchar", nullable: true),
                    IsCredit = table.Column<bool>(type: "boolean", nullable: false),
                    GoodsReturnSlipId = table.Column<string>(type: "varchar", nullable: true),
                    RecordedByUserId = table.Column<string>(type: "varchar", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PaymentMethod = table.Column<int>(type: "integer", nullable: true),
                    IsChequePending = table.Column<bool>(type: "boolean", nullable: false),
                    IsVoided = table.Column<bool>(type: "boolean", nullable: false),
                    SaleChequeId = table.Column<string>(type: "varchar", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReceivablePayments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ReceivablePayments_CustomerReceivables_CustomerReceivableId",
                        column: x => x.CustomerReceivableId,
                        principalTable: "CustomerReceivables",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ReceivablePayments_GoodsReturnSlips_GoodsReturnSlipId",
                        column: x => x.GoodsReturnSlipId,
                        principalTable: "GoodsReturnSlips",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ReceivablePayments_Users_RecordedByUserId",
                        column: x => x.RecordedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SalesReturnDeductions",
                columns: table => new
                {
                    Id = table.Column<string>(type: "varchar(36)", maxLength: 36, nullable: false),
                    GoodsReturnSlipId = table.Column<string>(type: "varchar", nullable: false),
                    OriginalSaleId = table.Column<string>(type: "varchar", nullable: false),
                    OriginalInvoiceNumber = table.Column<string>(type: "varchar", nullable: false),
                    DeductionDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    OriginalSaleDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    ProcessedByUserId = table.Column<string>(type: "varchar", nullable: false),
                    IsReversed = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalesReturnDeductions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SalesReturnDeductions_GoodsReturnSlips_GoodsReturnSlipId",
                        column: x => x.GoodsReturnSlipId,
                        principalTable: "GoodsReturnSlips",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SalesReturnDeductions_Users_ProcessedByUserId",
                        column: x => x.ProcessedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "BouncedChequeHistories",
                columns: table => new
                {
                    Id = table.Column<string>(type: "varchar", nullable: false),
                    SaleChequeId = table.Column<string>(type: "varchar", nullable: false),
                    ChequeNumber = table.Column<string>(type: "varchar", nullable: false),
                    BankName = table.Column<string>(type: "varchar", nullable: false),
                    Branch = table.Column<string>(type: "varchar", nullable: true),
                    CustomerName = table.Column<string>(type: "varchar", nullable: false),
                    CustomerId = table.Column<string>(type: "varchar", nullable: true),
                    InvoiceNumber = table.Column<string>(type: "varchar", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric", nullable: false),
                    MaturityDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    BouncedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Reason = table.Column<string>(type: "varchar", nullable: false),
                    PenaltyAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    ProcessedByUserId = table.Column<string>(type: "varchar", nullable: false),
                    CustomerReceivableId = table.Column<string>(type: "varchar", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BouncedChequeHistories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BouncedChequeHistories_SaleCheques_SaleChequeId",
                        column: x => x.SaleChequeId,
                        principalTable: "SaleCheques",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "InventoryAdjustmentRequestLines",
                columns: table => new
                {
                    Id = table.Column<string>(type: "varchar", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    InventoryAdjustmentRequestId = table.Column<string>(type: "varchar", nullable: false),
                    ProductBatchId = table.Column<string>(type: "varchar", nullable: false),
                    SystemQuantity = table.Column<int>(type: "integer", nullable: false),
                    ActualQuantity = table.Column<int>(type: "integer", nullable: false),
                    Difference = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InventoryAdjustmentRequestLines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InventoryAdjustmentRequestLines_InventoryAdjustmentRequests~",
                        column: x => x.InventoryAdjustmentRequestId,
                        principalTable: "InventoryAdjustmentRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_InventoryAdjustmentRequestLines_ProductBatches_ProductBatch~",
                        column: x => x.ProductBatchId,
                        principalTable: "ProductBatches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SaleItems",
                columns: table => new
                {
                    Id = table.Column<string>(type: "varchar(36)", maxLength: 36, nullable: false),
                    SaleId = table.Column<string>(type: "varchar", nullable: false),
                    ProductId = table.Column<string>(type: "varchar", nullable: false),
                    ProductName = table.Column<string>(type: "varchar", nullable: false),
                    ProductSku = table.Column<string>(type: "varchar", nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    UnitPrice = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    SellingPriceAtSale = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    CostPriceAtSale = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    ProfitAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    Discount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    LineTotal = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    ReturnedQuantity = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PendingReturnQuantity = table.Column<int>(type: "integer", nullable: false),
                    ProductBatchId = table.Column<string>(type: "varchar", nullable: true),
                    BatchCodeAtSale = table.Column<string>(type: "varchar", nullable: true),
                    BatchReceivedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SaleItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SaleItems_ProductBatches_ProductBatchId",
                        column: x => x.ProductBatchId,
                        principalTable: "ProductBatches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SaleItems_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SaleItems_Sales_SaleId",
                        column: x => x.SaleId,
                        principalTable: "Sales",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "GoodsExchangeLines",
                columns: table => new
                {
                    Id = table.Column<string>(type: "varchar", nullable: false),
                    GoodsExchangeId = table.Column<string>(type: "varchar", nullable: false),
                    ProductId = table.Column<string>(type: "varchar", nullable: false),
                    ProductName = table.Column<string>(type: "varchar", nullable: false),
                    ProductSku = table.Column<string>(type: "varchar", nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    UnitPrice = table.Column<decimal>(type: "numeric", nullable: false),
                    LineTotal = table.Column<decimal>(type: "numeric", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GoodsExchangeLines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GoodsExchangeLines_GoodsExchanges_GoodsExchangeId",
                        column: x => x.GoodsExchangeId,
                        principalTable: "GoodsExchanges",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_GoodsExchangeLines_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "GoodsReturnSlipItems",
                columns: table => new
                {
                    Id = table.Column<string>(type: "varchar(36)", maxLength: 36, nullable: false),
                    GoodsReturnSlipId = table.Column<string>(type: "varchar", nullable: false),
                    SaleItemId = table.Column<string>(type: "varchar", nullable: false),
                    ProductId = table.Column<string>(type: "varchar", nullable: false),
                    ProductName = table.Column<string>(type: "varchar", nullable: false),
                    ProductSku = table.Column<string>(type: "varchar", nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    UnitPrice = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    LineTotal = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SellingPriceAtSale = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    Condition = table.Column<int>(type: "integer", nullable: false),
                    CostPriceAtSale = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    ProductBatchId = table.Column<string>(type: "varchar", nullable: true),
                    BatchCode = table.Column<string>(type: "varchar", nullable: true),
                    BatchReceivedDate = table.Column<string>(type: "varchar", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GoodsReturnSlipItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GoodsReturnSlipItems_GoodsReturnSlips_GoodsReturnSlipId",
                        column: x => x.GoodsReturnSlipId,
                        principalTable: "GoodsReturnSlips",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_GoodsReturnSlipItems_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_GoodsReturnSlipItems_SaleItems_SaleItemId",
                        column: x => x.SaleItemId,
                        principalTable: "SaleItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BouncedChequeHistories_SaleChequeId",
                table: "BouncedChequeHistories",
                column: "SaleChequeId");

            migrationBuilder.CreateIndex(
                name: "IX_Categories_ParentCategoryId",
                table: "Categories",
                column: "ParentCategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_CustomerReceivables_CustomerId",
                table: "CustomerReceivables",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_CustomerReceivables_SaleId",
                table: "CustomerReceivables",
                column: "SaleId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GoodsExchangeLines_GoodsExchangeId",
                table: "GoodsExchangeLines",
                column: "GoodsExchangeId");

            migrationBuilder.CreateIndex(
                name: "IX_GoodsExchangeLines_ProductId",
                table: "GoodsExchangeLines",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_GoodsExchanges_CompletedByUserId",
                table: "GoodsExchanges",
                column: "CompletedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_GoodsExchanges_ExchangeNumber",
                table: "GoodsExchanges",
                column: "ExchangeNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GoodsExchanges_GoodsReturnSlipId",
                table: "GoodsExchanges",
                column: "GoodsReturnSlipId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GoodsExchanges_TopUpSaleId",
                table: "GoodsExchanges",
                column: "TopUpSaleId");

            migrationBuilder.CreateIndex(
                name: "IX_GoodsReturnSlipItems_GoodsReturnSlipId",
                table: "GoodsReturnSlipItems",
                column: "GoodsReturnSlipId");

            migrationBuilder.CreateIndex(
                name: "IX_GoodsReturnSlipItems_ProductId",
                table: "GoodsReturnSlipItems",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_GoodsReturnSlipItems_SaleItemId",
                table: "GoodsReturnSlipItems",
                column: "SaleItemId");

            migrationBuilder.CreateIndex(
                name: "IX_GoodsReturnSlips_GrsNumber",
                table: "GoodsReturnSlips",
                column: "GrsNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GoodsReturnSlips_OriginalSaleId",
                table: "GoodsReturnSlips",
                column: "OriginalSaleId");

            migrationBuilder.CreateIndex(
                name: "IX_GoodsReturnSlips_ProcessedByUserId",
                table: "GoodsReturnSlips",
                column: "ProcessedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_GoodsReturnSlips_VoidedByUserId",
                table: "GoodsReturnSlips",
                column: "VoidedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryAdjustmentRequestLines_InventoryAdjustmentRequestId",
                table: "InventoryAdjustmentRequestLines",
                column: "InventoryAdjustmentRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryAdjustmentRequestLines_ProductBatchId",
                table: "InventoryAdjustmentRequestLines",
                column: "ProductBatchId");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryAdjustmentRequests_ProductId",
                table: "InventoryAdjustmentRequests",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryAdjustmentRequests_RequestedByUserId",
                table: "InventoryAdjustmentRequests",
                column: "RequestedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryAdjustmentRequests_ReviewedByUserId",
                table: "InventoryAdjustmentRequests",
                column: "ReviewedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryTransactions_ProductId",
                table: "InventoryTransactions",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryTransactions_StockReceivingId",
                table: "InventoryTransactions",
                column: "StockReceivingId");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryTransactions_UserId",
                table: "InventoryTransactions",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductBatches_ProductId",
                table: "ProductBatches",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductBatches_StockReceivingId",
                table: "ProductBatches",
                column: "StockReceivingId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductBatches_SupplierId",
                table: "ProductBatches",
                column: "SupplierId");

            migrationBuilder.CreateIndex(
                name: "IX_Products_Barcode",
                table: "Products",
                column: "Barcode");

            migrationBuilder.CreateIndex(
                name: "IX_Products_CategoryId",
                table: "Products",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_Products_Sku",
                table: "Products",
                column: "Sku",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Products_SupplierId",
                table: "Products",
                column: "SupplierId");

            migrationBuilder.CreateIndex(
                name: "IX_ReceivablePayments_CustomerReceivableId",
                table: "ReceivablePayments",
                column: "CustomerReceivableId");

            migrationBuilder.CreateIndex(
                name: "IX_ReceivablePayments_GoodsReturnSlipId",
                table: "ReceivablePayments",
                column: "GoodsReturnSlipId");

            migrationBuilder.CreateIndex(
                name: "IX_ReceivablePayments_RecordedByUserId",
                table: "ReceivablePayments",
                column: "RecordedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Roles_Name",
                table: "Roles",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SaleCheques_SaleId",
                table: "SaleCheques",
                column: "SaleId");

            migrationBuilder.CreateIndex(
                name: "IX_SaleItems_ProductBatchId",
                table: "SaleItems",
                column: "ProductBatchId");

            migrationBuilder.CreateIndex(
                name: "IX_SaleItems_ProductId",
                table: "SaleItems",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_SaleItems_SaleId",
                table: "SaleItems",
                column: "SaleId");

            migrationBuilder.CreateIndex(
                name: "IX_SalePayments_SaleId",
                table: "SalePayments",
                column: "SaleId");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_CustomerId",
                table: "Sales",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_ReplacedBySaleId",
                table: "Sales",
                column: "ReplacedBySaleId");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_ReplacesSaleId",
                table: "Sales",
                column: "ReplacesSaleId");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_SaleNumber",
                table: "Sales",
                column: "SaleNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Sales_UserId",
                table: "Sales",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_VoidedByUserId",
                table: "Sales",
                column: "VoidedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_SalesReturnDeductions_GoodsReturnSlipId",
                table: "SalesReturnDeductions",
                column: "GoodsReturnSlipId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SalesReturnDeductions_ProcessedByUserId",
                table: "SalesReturnDeductions",
                column: "ProcessedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_StockReceivingAttachments_StockReceivingId",
                table: "StockReceivingAttachments",
                column: "StockReceivingId");

            migrationBuilder.CreateIndex(
                name: "IX_StockReceivingItems_ProductId",
                table: "StockReceivingItems",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_StockReceivingItems_StockReceivingId",
                table: "StockReceivingItems",
                column: "StockReceivingId");

            migrationBuilder.CreateIndex(
                name: "IX_StockReceivings_ReceivingNumber",
                table: "StockReceivings",
                column: "ReceivingNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StockReceivings_RequestedByUserId",
                table: "StockReceivings",
                column: "RequestedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_StockReceivings_ReviewedByUserId",
                table: "StockReceivings",
                column: "ReviewedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_StockReceivings_SupplierId",
                table: "StockReceivings",
                column: "SupplierId");

            migrationBuilder.CreateIndex(
                name: "IX_SupplierAttachments_SupplierId",
                table: "SupplierAttachments",
                column: "SupplierId");

            migrationBuilder.CreateIndex(
                name: "IX_SupplierContacts_SupplierId",
                table: "SupplierContacts",
                column: "SupplierId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_RoleId",
                table: "Users",
                column: "RoleId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AuditLogs");

            migrationBuilder.DropTable(
                name: "BouncedChequeHistories");

            migrationBuilder.DropTable(
                name: "GoodsExchangeLines");

            migrationBuilder.DropTable(
                name: "GoodsReturnSlipItems");

            migrationBuilder.DropTable(
                name: "InventoryAdjustmentRequestLines");

            migrationBuilder.DropTable(
                name: "InventoryTransactions");

            migrationBuilder.DropTable(
                name: "ReceivablePayments");

            migrationBuilder.DropTable(
                name: "SalePayments");

            migrationBuilder.DropTable(
                name: "SalesReportVerifications");

            migrationBuilder.DropTable(
                name: "SalesReturnDeductions");

            migrationBuilder.DropTable(
                name: "SteelBatches");

            migrationBuilder.DropTable(
                name: "StockReceivingAttachments");

            migrationBuilder.DropTable(
                name: "StockReceivingItems");

            migrationBuilder.DropTable(
                name: "StoreSettings");

            migrationBuilder.DropTable(
                name: "SupplierAttachments");

            migrationBuilder.DropTable(
                name: "SupplierContacts");

            migrationBuilder.DropTable(
                name: "SaleCheques");

            migrationBuilder.DropTable(
                name: "GoodsExchanges");

            migrationBuilder.DropTable(
                name: "SaleItems");

            migrationBuilder.DropTable(
                name: "InventoryAdjustmentRequests");

            migrationBuilder.DropTable(
                name: "CustomerReceivables");

            migrationBuilder.DropTable(
                name: "GoodsReturnSlips");

            migrationBuilder.DropTable(
                name: "ProductBatches");

            migrationBuilder.DropTable(
                name: "Sales");

            migrationBuilder.DropTable(
                name: "Products");

            migrationBuilder.DropTable(
                name: "StockReceivings");

            migrationBuilder.DropTable(
                name: "Customers");

            migrationBuilder.DropTable(
                name: "Categories");

            migrationBuilder.DropTable(
                name: "Suppliers");

            migrationBuilder.DropTable(
                name: "Users");

            migrationBuilder.DropTable(
                name: "Roles");
        }
    }
}

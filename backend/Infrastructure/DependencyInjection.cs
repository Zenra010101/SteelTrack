using SteelTrack.Application.Interfaces;
using SteelTrack.Domain.Interfaces;
using SteelTrack.Infrastructure.Persistence;
using SteelTrack.Infrastructure.Repositories;
using SteelTrack.Infrastructure.Services;
using SteelTrack.Infrastructure.Services.ProductCatalog;
using SteelTrack.Infrastructure.Services.Reports;
using SteelTrack.Infrastructure.Settings;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace SteelTrack.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<JwtSettings>(configuration.GetSection(JwtSettings.SectionName));
        services.Configure<ExchangeWorkflowOptions>(configuration.GetSection(ExchangeWorkflowOptions.SectionName));

        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? "Data Source=steeltrack.db";

        services.AddDbContext<AppDbContext>(options =>
        {
            options.ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));

            var isPostgres = connectionString.Contains("Host=", StringComparison.OrdinalIgnoreCase) ||
                             connectionString.Contains("Port=5432", StringComparison.OrdinalIgnoreCase) ||
                             connectionString.Contains("databaseasp.net", StringComparison.OrdinalIgnoreCase) ||
                             connectionString.Contains("supabase.com", StringComparison.OrdinalIgnoreCase) ||
                             connectionString.Contains("postgres", StringComparison.OrdinalIgnoreCase);

            if (isPostgres)
                options.UseNpgsql(connectionString);
            else if (connectionString.Contains("Initial Catalog=", StringComparison.OrdinalIgnoreCase) ||
                     connectionString.Contains("SQLEXPRESS", StringComparison.OrdinalIgnoreCase) ||
                     connectionString.Contains("Server=", StringComparison.OrdinalIgnoreCase))
                options.UseSqlServer(connectionString);
            else
                options.UseSqlite(connectionString);
        });

        services.AddScoped<SteelTrack.Infrastructure.Persistence.SteelTrackDbContext>(sp =>
            new SteelTrack.Infrastructure.Persistence.SteelTrackDbContext(
                sp.GetRequiredService<DbContextOptions<AppDbContext>>()));
        services.AddSingleton<SteelTrack.Application.Interfaces.ISteelRepository, SteelTrack.Infrastructure.Repositories.InMemorySteelRepository>();

        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IProductRepository, ProductRepository>();
        services.AddScoped<ISaleRepository, SaleRepository>();
        services.AddScoped<IAuditLogRepository, AuditLogRepository>();
        services.AddScoped<ISupplierRepository, SupplierRepository>();
        services.AddScoped<IStockReceivingRepository, StockReceivingRepository>();
        services.AddScoped<IGoodsReturnSlipRepository, GoodsReturnSlipRepository>();
        services.AddScoped<IInventoryAdjustmentRepository, InventoryAdjustmentRepository>();
        services.AddScoped<ICustomerRepository, CustomerRepository>();
        services.AddScoped<IReceivableRepository, ReceivableRepository>();
        services.AddScoped<IChequeRepository, ChequeRepository>();
        services.AddScoped<IExpenseVoucherRepository, ExpenseVoucherRepository>();

        services.AddScoped<JwtTokenService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IProductService, ProductService>();
        services.AddScoped<IBatchAllocationService, BatchAllocationService>();
        services.AddScoped<IProductBatchService, ProductBatchService>();
        services.AddScoped<ICategoryService, CategoryService>();
        services.AddScoped<ISaleService, SaleService>();
        services.AddScoped<IInventoryService, InventoryService>();
        services.AddScoped<IInventoryExportService, InventoryExportService>();
        services.AddScoped<IDashboardService, DashboardService>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IAuditService, AuditService>();
        services.AddScoped<IAuditLogService, AuditLogService>();
        services.AddScoped<ISupplierService, SupplierService>();
        services.AddScoped<ISupplierExportService, SupplierExportService>();
        services.AddScoped<IGlobalSearchService, GlobalSearchService>();
        services.AddScoped<IStockReceivingService, StockReceivingService>();
        services.AddScoped<IStockReceivingExportService, StockReceivingExportService>();
        services.AddScoped<IAlertsService, AlertsService>();
        services.AddScoped<IGoodsReturnSlipService, GoodsReturnSlipService>();
        services.AddScoped<IGrsExportService, GrsExportService>();
        services.AddScoped<IInventoryAdjustmentService, InventoryAdjustmentService>();
        services.AddScoped<IInventoryAdjustmentExportService, InventoryAdjustmentExportService>();
        services.AddScoped<ICustomerService, CustomerService>();
        services.AddScoped<IReceivableService, ReceivableService>();
        services.AddScoped<IReceivableExportService, ReceivableExportService>();
        services.AddScoped<IChequeService, ChequeService>();
        services.AddScoped<IStoreSettingsService, StoreSettingsService>();
        services.AddScoped<IProfitAnalyticsService, ProfitAnalyticsService>();
        services.AddScoped<ReportQueryEngine>();
        services.AddScoped<IReportService, ReportService>();
        services.AddScoped<IArchiveService, ArchiveService>();
        services.AddScoped<IProductCatalogImportService, ProductCatalogImportService>();
        services.AddScoped<IExpenseService, ExpenseService>();
        services.AddScoped<IApprovalRequestService, ApprovalRequestService>();

        // --- LSTM forecasting service -------------------------------------
        // The Python forecasting service is a separate process. It is
        // reached over HTTP with a shared secret, and the .NET API falls
        // back to a legacy estimate when it is unreachable.
        services.ConfigureLstmService(configuration);

        services.AddHttpClient<ILstmForecastClient, LstmForecastClient>((sp, client) =>
        {
            var settings = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<LstmServiceSettings>>().Value;
            client.BaseAddress = new Uri(settings.BaseUrl.TrimEnd('/') + "/");
            client.Timeout = TimeSpan.FromSeconds(30);
        })
        // The forecasting service is a downstream dependency: a failure
        // there must not fail the request, so errors are not retried here
        // (the service falls back to the legacy estimate instead).
        .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
        {
            PooledConnectionLifetime = TimeSpan.FromMinutes(5),
        });

        services.AddScoped<ILstmForecastService, LstmForecastService>();
        services.AddScoped<IRbdssService, RbdssService>();

        services.AddHostedService<ExpenseAttachmentRetentionService>();

        return services;
    }
}

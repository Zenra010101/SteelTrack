using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using FluentValidation.AspNetCore;
using SteelTrack.Api;
using SteelTrack.Api.Middleware;
using SteelTrack.Application;
using SteelTrack.Infrastructure;
using SteelTrack.Infrastructure.Persistence;
using SteelTrack.Infrastructure.Settings;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Register Clean Architecture Layers
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

// Add Controllers with JSON Enum string converter for clean API responses
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });
builder.Services.AddFluentValidationAutoValidation();

// JWT Authentication Setup
var jwtSettings = builder.Configuration.GetSection(JwtSettings.SectionName).Get<JwtSettings>() 
    ?? new JwtSettings
    {
        Secret = "SteelTrack_Enterprise_Super_Secret_Key_2026_Secure_JWT_Key_XYZ123!",
        Issuer = "SteelTrack",
        Audience = "SteelTrack",
        ExpirationHours = 12
    };

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSettings.Issuer,
            ValidAudience = jwtSettings.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.Secret))
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("login", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 15,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
});

// OpenAPI & Swagger Documentation
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configure CORS for Frontend Development
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://127.0.0.1:3000")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

if (CatalogImportCli.IsCatalogToXlsxCommand(args))
    Environment.Exit(CatalogImportCli.RunToXlsx(args));

await DataSeeder.SeedAsync(app.Services);

if (CatalogImportCli.IsCatalogImportCommand(args))
    Environment.Exit(await CatalogImportCli.RunAsync(app, args));

if (AdminCli.IsAdminCommand(args))
    Environment.Exit(await AdminCli.RunAsync(app, args));

app.UseMiddleware<ExceptionHandlingMiddleware>();

// Configure HTTP request pipeline
if (app.Environment.IsDevelopment() || true) // Enable Swagger in all dev/test modes
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "SteelTrack API v1");
        c.RoutePrefix = "swagger";
    });
}

app.UseCors("AllowFrontend");
app.UseRateLimiter();

// Ensure wwwroot directory exists to avoid middleware warning in local dev
var wwwrootPath = Path.Combine(builder.Environment.ContentRootPath, "wwwroot");
if (!Directory.Exists(wwwrootPath))
{
    Directory.CreateDirectory(wwwrootPath);
}

// Serve frontend SPA static files (HTML, CSS, JS, Assets) from wwwroot
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

app.MapGet("/api/health/db", async (IServiceProvider sp) =>
{
    var db = sp.GetService<AppDbContext>();
    if (db == null)
    {
        return Results.Json(new { status = "Error", message = "AppDbContext is not registered." }, statusCode: 500);
    }

    try
    {
        using var conn = db.Database.GetDbConnection();
        await conn.OpenAsync();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';";
        var tableCount = await cmd.ExecuteScalarAsync();

        return Results.Ok(new
        {
            status = "Healthy",
            database = conn.Database,
            host = conn.DataSource,
            publicTableCount = tableCount,
            connectedAtUtc = DateTime.UtcNow
        });
    }
    catch (Exception ex)
    {
        return Results.Json(new { status = "Unhealthy", error = ex.Message }, statusCode: 503);
    }
});

app.MapControllers();
app.MapFallbackToFile("index.html");

app.Run();

using System.Text.Json.Serialization;
using SteelTrack.Application.Interfaces;
using SteelTrack.Application.Services;
using SteelTrack.Infrastructure;
using SteelTrack.Infrastructure.Persistence;
using SteelTrack.Infrastructure.Persistence.Seeders;

var builder = WebApplication.CreateBuilder(args);

// Add Controllers with JSON Enum string converter for clean API responses
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

// OpenAPI & Swagger Documentation
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new()
    {
        Title = "SteelTrack Inventory API",
        Version = "v1",
        Description = "Clean Architecture Backend API for SteelTrack Inventory Management System"
    });
});

// Configure CORS for Frontend Development
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// Register Clean Architecture Layers
builder.Services.AddInfrastructure(builder.Configuration); // Registers PostgreSQL DbContext & Repositories
builder.Services.AddScoped<IInventoryService, InventoryService>();

var app = builder.Build();

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

// Ensure wwwroot directory exists to avoid middleware warning in local dev
var wwwrootPath = Path.Combine(builder.Environment.ContentRootPath, "wwwroot");
if (!Directory.Exists(wwwrootPath))
{
    Directory.CreateDirectory(wwwrootPath);
}

// Serve frontend SPA static files (HTML, CSS, JS, Assets) from wwwroot
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseAuthorization();

app.MapControllers();
app.MapFallbackToFile("index.html");

// Seeder command line and API hooks
if (args.Contains("--seed") || args.Contains("--seed-only"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetService<SteelTrackDbContext>();
    if (db != null)
    {
        var counts = await DatabaseSeeder.SeedAsync(db);
        Console.WriteLine("Database seeded successfully.");
    }
    else
    {
        Console.WriteLine("ERROR: SteelTrackDbContext could not be resolved. Please verify connection string in appsettings.json.");
    }

    if (args.Contains("--seed-only"))
    {
        return;
    }

    Console.WriteLine("Continuing to launch SteelTrack web server...");
}

app.MapGet("/api/admin/seed", async (IServiceProvider sp) =>
{
    var db = sp.GetService<SteelTrackDbContext>();
    if (db == null) return Results.BadRequest(new { error = "Database context not configured or unavailable." });
    var counts = await DatabaseSeeder.SeedAsync(db);
    return Results.Ok(new { message = "SteelTrack database seeded successfully.", counts });
});

app.MapPost("/api/admin/seed", async (IServiceProvider sp) =>
{
    var db = sp.GetService<SteelTrackDbContext>();
    if (db == null) return Results.BadRequest(new { error = "Database context not configured or unavailable." });
    var counts = await DatabaseSeeder.SeedAsync(db);
    return Results.Ok(new { message = "SteelTrack database seeded successfully.", counts });
});

app.Run();

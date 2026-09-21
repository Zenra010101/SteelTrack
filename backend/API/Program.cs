using System.Text.Json.Serialization;
using SteelTrack.Application.Interfaces;
using SteelTrack.Application.Services;
using SteelTrack.Infrastructure;

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

app.UseAuthorization();

app.MapControllers();

app.Run();

using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using SteelTrack.Domain.Entities;
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
if (args.Contains("--test-db"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetService<SteelTrackDbContext>();
    if (db == null)
    {
        Console.WriteLine("[DB_TEST_FAIL]: SteelTrackDbContext is not registered.");
        return;
    }

    try
    {
        Console.WriteLine("[DB_TEST_INFO]: Testing live connection through SteelTrackDbContext...");
        using var conn = db.Database.GetDbConnection();
        Console.WriteLine($"[DB_TARGET]: Host={conn.DataSource}, Database={conn.Database}");
        await conn.OpenAsync();
        Console.WriteLine("[DB_TEST_SUCCESS]: Live connection established successfully!");

        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT current_database(), current_user, version();";
        using var reader = await cmd.ExecuteReaderAsync();
        if (await reader.ReadAsync())
        {
            Console.WriteLine($"[DB_INSTANCE]: Database='{reader.GetString(0)}', User='{reader.GetString(1)}'");
            Console.WriteLine($"[DB_VERSION]: {reader.GetString(2)}");
        }
        reader.Close();

        // Verify EF Core Users query with Role and Branch joins
        Console.WriteLine("[EF_QUERY_TEST]: Querying db.Users with Include(u => u.Role) and Include(u => u.Branch)...");
        var usersFromDb = await db.Users.AsNoTracking().Include(u => u.Role).Include(u => u.Branch).ToListAsync();
        Console.WriteLine($"[EF_QUERY_SUCCESS]: Successfully loaded {usersFromDb.Count} users with Role & Branch joins from live database!");
        foreach (var u in usersFromDb.Take(5))
        {
            Console.WriteLine($"  - {u.FullName} ({u.Email}) | Role: {u.Role?.Name ?? "None"} | Branch: {u.Branch?.Name ?? "All/None"}");
        }

        var targetTables = new[] { "Users", "Roles", "Branches", "UserBranchAccess" };
        foreach (var tbl in targetTables)
        {
            cmd.CommandText = $"SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '{tbl}' ORDER BY ordinal_position;";
            Console.WriteLine($"[COLUMNS OF {tbl}]:");
            using (var cReader = await cmd.ExecuteReaderAsync())
            {
                while (await cReader.ReadAsync())
                {
                    Console.WriteLine($"  - {cReader.GetString(0)} ({cReader.GetString(1)})");
                }
            }

            cmd.CommandText = $"SELECT * FROM public.\"{tbl}\" LIMIT 5;";
            using (var dReader = await cmd.ExecuteReaderAsync())
            {
                Console.WriteLine($"[SAMPLE DATA FOR {tbl}]:");
                var fieldCount = dReader.FieldCount;
                while (await dReader.ReadAsync())
                {
                    var rowVals = new List<string>();
                    for (int i = 0; i < fieldCount; i++)
                    {
                        rowVals.Add($"{dReader.GetName(i)}={dReader.GetValue(i)}");
                    }
                    Console.WriteLine("    " + string.Join(", ", rowVals));
                }
            }
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[DB_TEST_ERROR]: {ex.Message}");
    }

    return;
}

if (args.Contains("--provision-managers"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<SteelTrackDbContext>();

    Console.WriteLine("[PROVISION]: Checking 'Branch Manager' role in live database...");
    var roleId = "55555555-5555-5555-5555-555555555501";
    var bmRole = await db.Roles.FindAsync(roleId);
    if (bmRole == null)
    {
        bmRole = new Role
        {
            Id = roleId,
            Name = "Branch Manager",
            Description = "Branch Manager with operational management and inventory oversight over assigned branch",
            CreatedAt = DateTime.UtcNow
        };
        db.Roles.Add(bmRole);
        await db.SaveChangesAsync();
        Console.WriteLine("[PROVISION]: Role 'Branch Manager' created successfully.");
    }
    else
    {
        Console.WriteLine("[PROVISION]: Role 'Branch Manager' already exists.");
    }

    var managers = new[]
    {
        new { Id = "22222222-2222-2222-2222-222222222201", FullName = "Maria Santos", Email = "manager.davao@steeltrack.com", BranchId = "11111111-1111-1111-1111-111111111101", Password = "DavaoMgr@2026!", AccessId = "33333333-3333-3333-3333-333333333301" },
        new { Id = "22222222-2222-2222-2222-222222222202", FullName = "Ana Gonzales", Email = "manager.cagayan@steeltrack.com", BranchId = "11111111-1111-1111-1111-111111111102", Password = "CagayanMgr@2026!", AccessId = "33333333-3333-3333-3333-333333333302" },
        new { Id = "22222222-2222-2222-2222-222222222203", FullName = "Carlos Reyes", Email = "manager.cebu@steeltrack.com", BranchId = "11111111-1111-1111-1111-111111111103", Password = "CebuMgr@2026!", AccessId = "33333333-3333-3333-3333-333333333303" },
        new { Id = "22222222-2222-2222-2222-222222222204", FullName = "Juan Dela Cruz", Email = "manager.mandaue@steeltrack.com", BranchId = "11111111-1111-1111-1111-111111111104", Password = "MandaueMgr@2026!", AccessId = "33333333-3333-3333-3333-333333333304" }
    };

    foreach (var m in managers)
    {
        var existingUser = await db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == m.Email.ToLower() || u.Id == m.Id);
        if (existingUser == null)
        {
            var user = new User
            {
                Id = m.Id,
                FullName = m.FullName,
                Email = m.Email,
                RoleId = roleId,
                BranchId = m.BranchId,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(m.Password),
                IsActive = true,
                IsMainOwner = false,
                CanViewAllBranches = false,
                CreatedAt = DateTime.UtcNow
            };
            db.Users.Add(user);
            await db.SaveChangesAsync();
            Console.WriteLine($"[PROVISION]: User '{m.FullName}' ({m.Email}) created.");
        }
        else
        {
            existingUser.RoleId = roleId;
            existingUser.BranchId = m.BranchId;
            existingUser.FullName = m.FullName;
            existingUser.PasswordHash = BCrypt.Net.BCrypt.HashPassword(m.Password);
            existingUser.IsActive = true;
            await db.SaveChangesAsync();
            Console.WriteLine($"[PROVISION]: User '{m.FullName}' ({m.Email}) updated with Branch Manager role.");
        }

        var existingAccess = await db.UserBranchAccesses.FirstOrDefaultAsync(a => a.UserId == m.Id && a.BranchId == m.BranchId);
        if (existingAccess == null)
        {
            db.UserBranchAccesses.Add(new UserBranchAccess
            {
                Id = m.AccessId,
                UserId = m.Id,
                BranchId = m.BranchId,
                CanView = true,
                CanOperate = true,
                CreatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
            Console.WriteLine($"[PROVISION]: UserBranchAccess granted for '{m.FullName}' on branch {m.BranchId}.");
        }
    }

    Console.WriteLine("[PROVISION_COMPLETE]: All 4 Branch Managers successfully provisioned in the live database!");
    return;
}

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

app.MapGet("/api/health/db", async (IServiceProvider sp) =>
{
    var db = sp.GetService<SteelTrackDbContext>();
    if (db == null)
    {
        return Results.Json(new { status = "Error", message = "SteelTrackDbContext is not registered." }, statusCode: 500);
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

app.Run();

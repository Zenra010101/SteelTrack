using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using FluentValidation.AspNetCore;
using SteelTrack.Api;
using SteelTrack.Api.Common;
using SteelTrack.Api.Middleware;
using SteelTrack.Application;
using SteelTrack.Infrastructure;
using SteelTrack.Infrastructure.Persistence;
using SteelTrack.Infrastructure.Services;
using SteelTrack.Infrastructure.Settings;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

/// <summary>
/// Key under which the reason a session ended is stashed on the request, so
/// the challenge handler can report it.
/// </summary>
const string SessionEndReasonKey = "SteelTrack.SessionEndReason";

static string ResolveChallengeReason(JwtBearerChallengeContext context)
{
    var failure = context.AuthenticateFailure;

    if (failure is SecurityTokenExpiredException)
        return SessionEndReasons.TokenExpired;

    if (failure is SecurityTokenInvalidSignatureException
        or SecurityTokenInvalidIssuerException
        or SecurityTokenInvalidAudienceException
        or SecurityTokenInvalidAlgorithmException)
        return SessionEndReasons.InvalidToken;

    // No token at all.
    if (string.IsNullOrEmpty(context.ErrorDescription) && failure is null)
        return SessionEndReasons.MissingToken;

    return SessionEndReasons.InvalidToken;
}

static string MessageForReason(string reason) => reason switch
{
    SessionEndReasons.ServerRestarted =>
        string.Empty,
    SessionEndReasons.TokenExpired =>
        "Your session expired. Please sign in again.",
    SessionEndReasons.MissingToken =>
        "No session token was supplied. Please sign in again.",
    SessionEndReasons.Forbidden =>
        "Your account does not have access to this area.",
    _ =>
        "Your session is no longer valid. Please sign in again."
};

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
//
// The server instance owns the JWT secret and the process instance id, so the
// value tokens are signed with and the value they are validated against can
// never drift apart. See ServerInstance for what the instance id is for.
//
// It is registered as a singleton here so the token service signs with the
// very same instance id the validation path checks against. Constructing a
// second one would give it a different id and reject every token it issued.
var serverInstance = ServerInstance.Create(builder.Configuration);
builder.Services.AddSingleton(serverInstance);

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = serverInstance.Issuer,
            ValidAudience = serverInstance.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(serverInstance.Secret))
        };

        options.Events = new JwtBearerEvents
        {
            // A token minted by a process that is no longer running must not
            // keep working after a restart. The instance claim tells us which
            // process minted the token; if it is not this one, the session
            // predates the restart and has to end.
            OnTokenValidated = context =>
            {
                var mintedBy = context.Principal?.FindFirst(ServerInstance.InstanceClaimType)?.Value;

                if (string.IsNullOrEmpty(mintedBy) || mintedBy != serverInstance.InstanceId)
                {
                    context.HttpContext.Items[SessionEndReasonKey] = SessionEndReasons.ServerRestarted;
                    context.Fail("The token was issued by a previous instance of the server.");
                }

                return Task.CompletedTask;
            },

            // A 401 today has an empty body, so the browser cannot tell an
            // expired session from a server restart from a bad token. Write
            // the reason into the body.
            OnChallenge = async context =>
            {
                context.HandleResponse();

                var reason = context.HttpContext.Items[SessionEndReasonKey] as string
                    ?? ResolveChallengeReason(context);

                var message = MessageForReason(reason);

                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsJsonAsync(new
                {
                    success = false,
                    message,
                    reason
                });
            },

            // A 403 is an empty body too.
            OnForbidden = async context =>
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsJsonAsync(new
                {
                    success = false,
                    message = MessageForReason(SessionEndReasons.Forbidden),
                    reason = SessionEndReasons.Forbidden
                });
            }
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
builder.Services.AddSignalR();

// Configure CORS for Frontend Development and Production Domain
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(
                  "http://localhost:5173",
                  "http://127.0.0.1:5173",
                  "http://localhost:3000",
                  "http://127.0.0.1:3000",
                  "https://steeltrackerp.com",
                  "https://www.steeltrackerp.com",
                  "http://steeltrackerp.com",
                  "http://www.steeltrackerp.com"
              )
              .SetIsOriginAllowed(origin =>
                  origin.EndsWith("steeltrackerp.com", StringComparison.OrdinalIgnoreCase) ||
                  origin.StartsWith("http://localhost:", StringComparison.OrdinalIgnoreCase) ||
                  origin.StartsWith("http://127.0.0.1:", StringComparison.OrdinalIgnoreCase))
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

if (CatalogImportCli.IsCatalogToXlsxCommand(args))
    Environment.Exit(CatalogImportCli.RunToXlsx(args));

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

app.MapHub<SteelTrack.Api.Hubs.SteelTrackHub>("/hubs/steeltrack");
app.MapControllers();
app.MapFallbackToFile("index.html");

app.Run();

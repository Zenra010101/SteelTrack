using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace SteelTrack.Infrastructure.Persistence.Seeders;

public static class DatabaseSeeder
{
    public static async Task<Dictionary<string, int>> SeedAsync(SteelTrackDbContext context, ILogger? logger = null)
    {
        try
        {
            Console.WriteLine("[DatabaseSeeder] Starting SteelTrack database seeding...");
            logger?.LogInformation("Starting SteelTrack database seeding...");

            // Locate seed_data.sql relative to base directory
            var baseDir = AppDomain.CurrentDomain.BaseDirectory;
            var sqlFilePath = Path.Combine(baseDir, "seed_data.sql");

            // Look upward if running in development mode
            if (!File.Exists(sqlFilePath))
            {
                var currentDir = new DirectoryInfo(Directory.GetCurrentDirectory());
                while (currentDir != null)
                {
                    var potentialPath = Path.Combine(currentDir.FullName, "backend", "seed_data.sql");
                    if (File.Exists(potentialPath))
                    {
                        sqlFilePath = potentialPath;
                        break;
                    }

                    potentialPath = Path.Combine(currentDir.FullName, "seed_data.sql");
                    if (File.Exists(potentialPath))
                    {
                        sqlFilePath = potentialPath;
                        break;
                    }

                    currentDir = currentDir.Parent;
                }
            }

            if (!File.Exists(sqlFilePath))
            {
                var err = $"seed_data.sql could not be located in base dir '{baseDir}' or parent paths. Ensure seed_data.sql is deployed.";
                Console.WriteLine($"[DatabaseSeeder] ERROR: {err}");
                logger?.LogError(err);
                throw new FileNotFoundException(err, sqlFilePath);
            }

            Console.WriteLine($"[DatabaseSeeder] Reading SQL statements from: {sqlFilePath}");
            logger?.LogInformation("Reading SQL statements from: {Path}", sqlFilePath);
            var sql = await File.ReadAllTextAsync(sqlFilePath);
            Console.WriteLine($"[DatabaseSeeder] SQL file size: {sql.Length:N0} characters.");

            await using var connection = context.Database.GetDbConnection();
            if (connection.State != System.Data.ConnectionState.Open)
            {
                await connection.OpenAsync();
            }

            Console.WriteLine($"[DatabaseSeeder] Connected to database '{connection.Database}' on host '{connection.DataSource}'.");

            // Verify if tables exist; if not, execute supabase_schema.sql first
            bool tablesExist = false;
            try
            {
                await using var checkCmd = connection.CreateCommand();
                checkCmd.CommandText = "SELECT 1 FROM information_schema.tables WHERE table_name = 'Products';";
                var res = await checkCmd.ExecuteScalarAsync();
                tablesExist = res != null;
            }
            catch { tablesExist = false; }

            if (!tablesExist)
            {
                var dir = Path.GetDirectoryName(sqlFilePath) ?? AppDomain.CurrentDomain.BaseDirectory;
                var schemaPath = Path.Combine(dir, "supabase_schema.sql");
                if (!File.Exists(schemaPath))
                {
                    schemaPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "supabase_schema.sql");
                }

                if (File.Exists(schemaPath))
                {
                    Console.WriteLine($"[DatabaseSeeder] Core tables missing. Initializing database schema from: {schemaPath}...");
                    var schemaSql = await File.ReadAllTextAsync(schemaPath);
                    await using var schemaCmd = connection.CreateCommand();
                    schemaCmd.CommandText = schemaSql;
                    schemaCmd.CommandTimeout = 300;
                    await schemaCmd.ExecuteNonQueryAsync();
                    Console.WriteLine("[DatabaseSeeder] Database schema initialized successfully.");
                }
            }

            Console.WriteLine("[DatabaseSeeder] Executing seed SQL data population script...");

            await using (var command = connection.CreateCommand())
            {
                command.CommandText = sql;
                command.CommandTimeout = 300;
                await command.ExecuteNonQueryAsync();
            }

            Console.WriteLine("[DatabaseSeeder] SQL execution finished. Verifying seeded record counts...");

            var counts = new Dictionary<string, int>();
            string[] tables = new[] { "Branches", "Products", "Users", "Roles", "Suppliers", "Customers", "Categories" };

            foreach (var table in tables)
            {
                try
                {
                    await using var countCmd = connection.CreateCommand();
                    countCmd.CommandText = $"SELECT COUNT(*) FROM \"{table}\";";
                    var result = await countCmd.ExecuteScalarAsync();
                    var count = Convert.ToInt32(result);
                    counts[table] = count;
                    Console.WriteLine($"[DatabaseSeeder] -> Table \"{table}\": {count} records");
                }
                catch (Exception countEx)
                {
                    Console.WriteLine($"[DatabaseSeeder] -> Table \"{table}\": Query failed ({countEx.Message})");
                }
            }

            Console.WriteLine("[DatabaseSeeder] Seeding completed successfully!");
            logger?.LogInformation("Successfully executed SteelTrack database seed script.");
            return counts;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DatabaseSeeder] FATAL ERROR during seeding: {ex.Message}");
            logger?.LogError(ex, "An error occurred while seeding the SteelTrack database.");
            throw;
        }
    }
}

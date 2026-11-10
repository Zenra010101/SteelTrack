using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SteelTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RemoveUnusedSubscriptionsStoreCreditsAndOfflineSales : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DROP TABLE IF EXISTS ""OfflineSalesBatchEvents"" CASCADE;
                DROP TABLE IF EXISTS ""OfflineSalesBatchItems"" CASCADE;
                DROP TABLE IF EXISTS ""OfflineSalesEntries"" CASCADE;
                DROP TABLE IF EXISTS ""OfflineSalesBatches"" CASCADE;
                DROP TABLE IF EXISTS ""StoreCreditUses"" CASCADE;
                DROP TABLE IF EXISTS ""StoreCredits"" CASCADE;
                DROP TABLE IF EXISTS ""SubscriptionRenewalHistories"" CASCADE;
                DROP TABLE IF EXISTS ""Subscriptions"" CASCADE;
                DELETE FROM ""__EFMigrationsHistory"" WHERE ""MigrationId"" IN (
                    '20260625061730_SubscriptionRenewalTracker',
                    '20261005105438_AddOfflineSalesBatches',
                    '20261005130114_AddOfflineSalesEntries',
                    '20261008064855_AddStoreCredits'
                );
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Drop of unused/abandoned tables is irreversible
        }
    }
}


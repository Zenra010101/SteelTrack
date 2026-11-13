using Microsoft.AspNetCore.SignalR;

namespace SteelTrack.Api.Hubs;

public class SteelTrackHub : Hub
{
    public async Task JoinBranchGroup(string branchName)
    {
        if (!string.IsNullOrWhiteSpace(branchName))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"branch_{branchName.ToLowerInvariant()}");
        }
    }

    public async Task LeaveBranchGroup(string branchName)
    {
        if (!string.IsNullOrWhiteSpace(branchName))
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"branch_{branchName.ToLowerInvariant()}");
        }
    }

    public async Task BroadcastInventoryUpdate(string productId, string branchId, int newQuantity)
    {
        await Clients.All.SendAsync("InventoryChanged", new
        {
            productId,
            branchId,
            newQuantity,
            timestamp = DateTime.UtcNow
        });
    }

    public async Task BroadcastPriceUpdate(string productId, decimal newPrice)
    {
        await Clients.All.SendAsync("PriceChanged", new
        {
            productId,
            newPrice,
            timestamp = DateTime.UtcNow
        });
    }

    public async Task BroadcastSaleCompleted(string saleId, string branch, decimal totalAmount, string cashierName)
    {
        await Clients.All.SendAsync("SaleCompleted", new
        {
            saleId,
            branch,
            totalAmount,
            cashierName,
            timestamp = DateTime.UtcNow
        });
    }

    public async Task BroadcastTransferRequested(string transferNumber, string sourceBranch, string destinationBranch, decimal weightInTons)
    {
        // Broadcast to all and specifically to recipient branch managers
        await Clients.All.SendAsync("TransferRequested", new
        {
            transferNumber,
            sourceBranch,
            destinationBranch,
            weightInTons,
            timestamp = DateTime.UtcNow
        });

        await Clients.Group($"branch_{destinationBranch.ToLowerInvariant()}").SendAsync("ApprovalRequired", new
        {
            type = "StockTransfer",
            title = $"New Transfer Request #{transferNumber}",
            message = $"{sourceBranch} requested to transfer {weightInTons}T to {destinationBranch}.",
            timestamp = DateTime.UtcNow
        });
    }
}


namespace SteelTrack.Domain.Constants;

public static class RoleNames
{
    public const string Owner = "Owner";
    public const string Cashier = "Cashier";
    public const string BranchManager = "Branch Manager";
    public const string SuperAdmin = "SuperAdmin";

    public static readonly string[] All = [Owner, Cashier, BranchManager, SuperAdmin];

    public static bool IsOwner(string? role) =>
        !string.IsNullOrWhiteSpace(role) && (
            string.Equals(role, Owner, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(role, SuperAdmin, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(role, BranchManager, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(role, "BranchManager", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase)
        );
}

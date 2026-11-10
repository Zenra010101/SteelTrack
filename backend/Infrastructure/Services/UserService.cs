using SteelTrack.Application.DTOs.Users;
using SteelTrack.Application.Exceptions;
using SteelTrack.Application.Interfaces;
using SteelTrack.Domain.Constants;
using SteelTrack.Domain.Enums;
using SteelTrack.Domain.Entities;
using SteelTrack.Domain.Interfaces;
using SteelTrack.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace SteelTrack.Infrastructure.Services;

public class UserService : IUserService
{
    private readonly IUserRepository _userRepository;
    private readonly AppDbContext _context;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public UserService(IUserRepository userRepository, AppDbContext context, IUnitOfWork unitOfWork, IAuditService auditService)
    {
        _userRepository = userRepository;
        _context = context;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public Task<IReadOnlyList<UserManagementDto>> GetAllAsync(CancellationToken cancellationToken = default)
        => GetAllAsync(Guid.Empty, string.Empty, cancellationToken);

    public async Task<IReadOnlyList<UserManagementDto>> GetAllAsync(Guid currentUserId, string currentUserRole, CancellationToken cancellationToken = default)
    {
        var query = _context.Users
            .Include(u => u.Role)
            .Include(u => u.Branch)
            .AsNoTracking();

        if (currentUserId != Guid.Empty)
        {
            var caller = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == currentUserId, cancellationToken);
            var isBranchManager = string.Equals(currentUserRole, RoleNames.BranchManager, StringComparison.OrdinalIgnoreCase) ||
                                  string.Equals(currentUserRole, "BranchManager", StringComparison.OrdinalIgnoreCase) ||
                                  (caller != null && caller.RoleId != Guid.Empty &&
                                   await _context.Roles.AnyAsync(r => r.Id == caller.RoleId && (r.Name == RoleNames.BranchManager || r.Name == "BranchManager"), cancellationToken));

            if (isBranchManager && caller?.BranchId != null)
            {
                query = query.Where(u => u.BranchId == caller.BranchId);
            }
        }

        var users = await query.OrderBy(u => u.FullName).ToListAsync(cancellationToken);
        return users.Select(Map).ToList();
    }

    public Task<UserManagementDto> CreateAsync(CreateUserRequest request, Guid userId, CancellationToken cancellationToken = default)
        => CreateAsync(request, userId, string.Empty, cancellationToken);

    public async Task<UserManagementDto> CreateAsync(CreateUserRequest request, Guid userId, string role, CancellationToken cancellationToken = default)
    {
        var email = request.Email.Trim().ToLower();
        if (await _userRepository.GetByEmailAsync(email, cancellationToken) is not null)
            throw new ConflictException("Email already exists");

        var roleName = !string.IsNullOrWhiteSpace(request.Role) ? request.Role : request.RoleName ?? string.Empty;
        var roleEntity = await _context.Roles.FirstOrDefaultAsync(r =>
            r.Name.ToLower() == roleName.ToLower() ||
            r.Name.Replace(" ", "").ToLower() == roleName.Replace(" ", "").ToLower(), cancellationToken)
            ?? throw new NotFoundException($"Role '{roleName}' not found");

        var caller = await _context.Users
            .Include(u => u.Role)
            .Include(u => u.Branch)
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        var isBranchManager = string.Equals(role, RoleNames.BranchManager, StringComparison.OrdinalIgnoreCase) ||
                              string.Equals(role, "BranchManager", StringComparison.OrdinalIgnoreCase) ||
                              (caller?.Role != null &&
                               (string.Equals(caller.Role.Name, RoleNames.BranchManager, StringComparison.OrdinalIgnoreCase) ||
                                string.Equals(caller.Role.Name, "BranchManager", StringComparison.OrdinalIgnoreCase)));

        Guid? targetBranchId;

        if (isBranchManager)
        {
            if (caller?.BranchId == null)
            {
                throw new ForbiddenException("Branch manager must have an assigned branch to create users.");
            }

            // Branch Managers cannot create Owner or SuperAdmin accounts
            if (RoleNames.IsOwner(roleEntity.Name) ||
                string.Equals(roleEntity.Name, RoleNames.SuperAdmin, StringComparison.OrdinalIgnoreCase))
            {
                throw new ForbiddenException("Branch managers cannot create Owner or SuperAdmin accounts.");
            }

            // Branch Managers can ONLY create accounts assigned strictly to their own branch
            if (request.BranchId.HasValue && request.BranchId.Value != caller.BranchId.Value)
            {
                throw new ForbiddenException("Branch managers are only permitted to create new accounts assigned strictly to their own branch.");
            }

            if (!string.IsNullOrWhiteSpace(request.BranchName) && caller.Branch != null &&
                !caller.Branch.Name.ToLower().Contains(request.BranchName.Trim().ToLower()) &&
                !request.BranchName.Trim().ToLower().Contains(caller.Branch.Name.ToLower()))
            {
                throw new ForbiddenException("Branch managers are only permitted to create new accounts assigned strictly to their own branch.");
            }

            // Strictly enforce caller's branch
            targetBranchId = caller.BranchId;
        }
        else
        {
            // Owner / SuperAdmin / System Admin can assign any branch or leave unassigned
            if (request.BranchId.HasValue)
            {
                targetBranchId = request.BranchId;
            }
            else if (!string.IsNullOrWhiteSpace(request.BranchName))
            {
                var branch = await _context.Branches.FirstOrDefaultAsync(b =>
                    b.Name.ToLower() == request.BranchName.Trim().ToLower() ||
                    b.Code.ToLower() == request.BranchName.Trim().ToLower(), cancellationToken);
                targetBranchId = branch?.Id;
            }
            else
            {
                targetBranchId = null;
            }
        }

        var user = new User
        {
            Email = email,
            FullName = request.FullName.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            RoleId = roleEntity.Id,
            BranchId = targetBranchId,
            IsActive = request.IsActive
        };

        await _userRepository.AddAsync(user, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(userId, null, "CREATE", "User", user.Id.ToString(), $"Created user {user.Email} for branch {targetBranchId}", null, cancellationToken);

        user.Role = roleEntity;
        if (targetBranchId.HasValue)
        {
            user.Branch = await _context.Branches.FindAsync(new object[] { targetBranchId.Value }, cancellationToken);
        }

        return Map(user);
    }

    public Task<UserManagementDto> UpdateAsync(Guid id, UpdateUserRequest request, Guid userId, CancellationToken cancellationToken = default)
        => UpdateAsync(id, request, userId, string.Empty, cancellationToken);

    public async Task<UserManagementDto> UpdateAsync(Guid id, UpdateUserRequest request, Guid userId, string role, CancellationToken cancellationToken = default)
    {
        var user = await _context.Users
            .Include(u => u.Role)
            .Include(u => u.Branch)
            .FirstOrDefaultAsync(u => u.Id == id, cancellationToken)
            ?? throw new NotFoundException("User not found");

        var caller = await _context.Users
            .Include(u => u.Role)
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        var isBranchManager = string.Equals(role, RoleNames.BranchManager, StringComparison.OrdinalIgnoreCase) ||
                              string.Equals(role, "BranchManager", StringComparison.OrdinalIgnoreCase) ||
                              (caller?.Role != null &&
                               (string.Equals(caller.Role.Name, RoleNames.BranchManager, StringComparison.OrdinalIgnoreCase) ||
                                string.Equals(caller.Role.Name, "BranchManager", StringComparison.OrdinalIgnoreCase)));

        if (isBranchManager)
        {
            if (caller?.BranchId == null || user.BranchId != caller.BranchId)
            {
                throw new ForbiddenException("Branch managers can only manage users in their own branch.");
            }

            if (request.BranchId.HasValue && request.BranchId.Value != caller.BranchId.Value)
            {
                throw new ForbiddenException("Branch managers cannot reassign users to another branch.");
            }
        }

        var roleName = !string.IsNullOrWhiteSpace(request.Role) ? request.Role : request.RoleName ?? string.Empty;
        var roleEntity = await _context.Roles.FirstOrDefaultAsync(r =>
            r.Name.ToLower() == roleName.ToLower() ||
            r.Name.Replace(" ", "").ToLower() == roleName.Replace(" ", "").ToLower(), cancellationToken)
            ?? throw new NotFoundException($"Role '{roleName}' not found");

        var oldRole = user.Role.Name;
        var oldActive = user.IsActive;

        user.FullName = request.FullName.Trim();
        user.RoleId = roleEntity.Id;
        user.IsActive = request.IsActive;

        if (!isBranchManager && request.BranchId.HasValue)
        {
            user.BranchId = request.BranchId.Value;
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        if (oldRole != roleEntity.Name)
        {
            await _auditService.LogAsync(
                userId, null, AuditLogCategory.Security, "ROLE_CHANGE", "User", id.ToString(),
                $"Role changed for {user.Email}", null, null, "Success",
                oldRole, roleEntity.Name, cancellationToken);
        }

        if (oldActive != request.IsActive)
        {
            var lockAction = request.IsActive ? "ACCOUNT_UNLOCK" : "ACCOUNT_LOCK";
            await _auditService.LogAsync(
                userId, null, AuditLogCategory.Security, lockAction, "User", id.ToString(),
                request.IsActive ? "Account activated" : "Account deactivated",
                null, null, "Success",
                oldActive.ToString(), request.IsActive.ToString(), cancellationToken);
        }

        await _auditService.LogAsync(
            userId, null, AuditLogCategory.Operational, "UPDATE", "User", id.ToString(),
            $"Updated user {user.Email}", null, cancellationToken: cancellationToken);

        user.Role = roleEntity;
        return Map(user);
    }

    private static UserManagementDto Map(User u) => new()
    {
        Id = u.Id,
        Email = u.Email,
        FullName = u.FullName,
        Role = u.Role?.Name ?? string.Empty,
        BranchId = u.BranchId,
        BranchName = u.Branch?.Name,
        BranchCode = u.Branch?.Code,
        IsActive = u.IsActive,
        CreatedAt = u.CreatedAt
    };
}

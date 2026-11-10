using SteelTrack.Application.DTOs.Users;

namespace SteelTrack.Application.Interfaces;

public interface IUserService
{
    Task<IReadOnlyList<UserManagementDto>> GetAllAsync(Guid currentUserId, string currentUserRole, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<UserManagementDto>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<UserManagementDto> CreateAsync(CreateUserRequest request, Guid userId, string role, CancellationToken cancellationToken = default);
    Task<UserManagementDto> CreateAsync(CreateUserRequest request, Guid userId, CancellationToken cancellationToken = default);
    Task<UserManagementDto> UpdateAsync(Guid id, UpdateUserRequest request, Guid userId, string role, CancellationToken cancellationToken = default);
    Task<UserManagementDto> UpdateAsync(Guid id, UpdateUserRequest request, Guid userId, CancellationToken cancellationToken = default);
}

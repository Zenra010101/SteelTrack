using System.Security.Claims;
using SteelTrack.Application.Common;
using SteelTrack.Application.DTOs.Users;
using SteelTrack.Application.Interfaces;
using SteelTrack.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SteelTrack.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = $"{RoleNames.Owner},{RoleNames.SuperAdmin},{RoleNames.BranchManager},BranchManager,Admin")]
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;

    public UsersController(IUserService userService) => _userService = userService;

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private string UserRole => User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;

    [HttpGet]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<UserManagementDto>>>> GetAll(CancellationToken cancellationToken)
    {
        var users = await _userService.GetAllAsync(UserId, UserRole, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<UserManagementDto>>.Ok(users));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<UserManagementDto>>> Create([FromBody] CreateUserRequest request, CancellationToken cancellationToken)
    {
        var user = await _userService.CreateAsync(request, UserId, UserRole, cancellationToken);
        return Ok(ApiResponse<UserManagementDto>.Ok(user, "User created"));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<UserManagementDto>>> Update(Guid id, [FromBody] UpdateUserRequest request, CancellationToken cancellationToken)
    {
        var user = await _userService.UpdateAsync(id, request, UserId, UserRole, cancellationToken);
        return Ok(ApiResponse<UserManagementDto>.Ok(user, "User updated"));
    }
}

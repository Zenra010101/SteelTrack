using SteelTrack.Domain.Entities;
using SteelTrack.Domain.Interfaces;
using SteelTrack.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace SteelTrack.Infrastructure.Repositories;

public class UserRepository : Repository<User>, IUserRepository
{
    public UserRepository(AppDbContext context) : base(context) { }

    public async Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default) =>
        await DbSet.Include(u => u.Role)
            .Include(u => u.Branch)
            .FirstOrDefaultAsync(u => u.Email.ToLower() == email.ToLower(), cancellationToken);

    public async Task<User?> GetByIdWithRoleAsync(Guid id, CancellationToken cancellationToken = default) =>
        await DbSet.Include(u => u.Role)
            .Include(u => u.Branch)
            .FirstOrDefaultAsync(u => u.Id == id, cancellationToken);
}

using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using SteelTrack.Domain.Entities;
using Microsoft.IdentityModel.Tokens;

namespace SteelTrack.Infrastructure.Services;

public class JwtTokenService
{
    private readonly ServerInstance _instance;

    public JwtTokenService(ServerInstance instance) => _instance = instance;

    public (string Token, DateTime ExpiresAt) GenerateToken(User user)
    {
        var expires = DateTime.UtcNow.AddHours(_instance.ExpirationHours);
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Name, user.FullName),
            new Claim(ClaimTypes.Role, user.Role.Name),

            // Which process minted this token. A restarted process will not
            // recognise the claim value of the process it replaced, so every
            // token issued before a restart is rejected from then on.
            new Claim(ServerInstance.InstanceClaimType, _instance.InstanceId)
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_instance.Secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _instance.Issuer,
            audience: _instance.Audience,
            claims: claims,
            expires: expires,
            signingCredentials: creds);

        return (new JwtSecurityTokenHandler().WriteToken(token), expires);
    }
}

using Microsoft.EntityFrameworkCore;
using StudentHub.API.Data;

namespace StudentHub.API.Services;

public class HubUserService
{
    private readonly AppDbContext _db;

    public HubUserService(AppDbContext db) { _db = db; }

    public async Task<int?> GetUserIdAsync(System.Security.Claims.ClaimsPrincipal principal)
    {
        var email = principal.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn")?.Value
                    ?? principal.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name")?.Value;

        Console.WriteLine($"HubUserService email: {email}");

        if (string.IsNullOrEmpty(email)) return null;

        var user = await _db.Students
            .FirstOrDefaultAsync(u => u.Email == email.ToLower());

        Console.WriteLine($"HubUserService userId: {user?.Id}");

        return user?.Id;
    }
}
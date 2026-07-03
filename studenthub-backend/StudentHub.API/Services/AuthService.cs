using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using StudentHub.API.Data;
using StudentHub.API.Models.Auth;
using StudentHub.API.Models.Entities;
using StudentHub.API.Services.Interfaces;

namespace StudentHub.API.Services;

public class AuthService : IAuthService
{
    private readonly AppDbContext _db;
    private readonly UserManager<IdentityUser> _userManager;

    public AuthService(AppDbContext db, UserManager<IdentityUser> userManager)
    {
        _db = db;
        _userManager = userManager;
    }

    public async Task<SyncResponse> SyncUserAsync(ClaimsPrincipal principal)
    {
        var email = GetEmail(principal);
        var fullName = principal.FindFirst("name")?.Value;
        var objectId = GetObjectId(principal);

        if (string.IsNullOrEmpty(email))
            throw new UnauthorizedAccessException("Token invalid: lipseste email-ul.");

        if (!email.EndsWith("@student.upt.ro", StringComparison.OrdinalIgnoreCase))
            throw new UnauthorizedAccessException("Acces permis doar pentru conturi @student.upt.ro.");

        var user = await _db.Students.FirstOrDefaultAsync(u => u.Email == email.ToLower());
        var isFirstLogin = false;

        if (user == null)
        {
            isFirstLogin = true;
            user = new User
            {
                Email = email.ToLower(),
                FullName = fullName ?? email.Split('@')[0],
                EntraObjectId = objectId,
                CreatedAt = DateTime.UtcNow,
                IsActive = true,
                LastSeenAt = DateTime.UtcNow
            };
            _db.Students.Add(user);
            await _db.SaveChangesAsync();
        }
        else
        {
            if (string.IsNullOrEmpty(user.EntraObjectId) && !string.IsNullOrEmpty(objectId))
                user.EntraObjectId = objectId;

            user.LastSeenAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            isFirstLogin = user.StudyType == null;
        }
        
        if (user.IsAdmin)
        {
            var identityUser = await _userManager.FindByEmailAsync(user.Email);
            if (identityUser == null)
            {
                identityUser = new IdentityUser
                {
                    UserName = user.Email,
                    Email = user.Email,
                    EmailConfirmed = true
                };
                await _userManager.CreateAsync(identityUser, "Admin@2024!");
                await _userManager.AddToRoleAsync(identityUser, "Admin");
            }
        }

        return new SyncResponse
        {
            User = MapToUserInfo(user),
            IsFirstLogin = isFirstLogin
        };
    }

    public async Task<UserInfo> CompleteProfileAsync(ClaimsPrincipal principal, CompleteProfileRequest request)
    {
        var user = await GetUserFromPrincipalAsync(principal);

        if (request.StudyType != "licenta" && request.StudyType != "master")
            throw new ArgumentException("Tip de studiu invalid. Valori acceptate: licenta, master.");

        user.StudyType = request.StudyType;
        user.Faculty = request.Faculty;
        user.Year = request.Year;
        user.Section = request.Section;

        await _db.SaveChangesAsync();
        return MapToUserInfo(user);
    }

    public async Task<UserInfo> GetMeAsync(ClaimsPrincipal principal)
    {
        var user = await GetUserFromPrincipalAsync(principal);
        return MapToUserInfo(user);
    }

    public async Task<UserInfo> UpdateProfileAsync(ClaimsPrincipal principal, UpdateProfileRequest request)
    {
        var user = await GetUserFromPrincipalAsync(principal);

        if (request.StudyType != null) user.StudyType = request.StudyType;
        if (request.Faculty != null) user.Faculty = request.Faculty;
        if (request.Year.HasValue) user.Year = request.Year;
        if (request.Section != null) user.Section = request.Section;

        await _db.SaveChangesAsync();
        return MapToUserInfo(user);
    }

    private async Task<User> GetUserFromPrincipalAsync(ClaimsPrincipal principal)
    {
        var email = GetEmail(principal);
        if (string.IsNullOrEmpty(email))
            throw new UnauthorizedAccessException("Neautorizat.");

        var user = await _db.Students.FirstOrDefaultAsync(u => u.Email == email.ToLower());
        if (user == null)
            throw new KeyNotFoundException("Utilizatorul nu a fost gasit.");

        return user;
    }

    private static string? GetEmail(ClaimsPrincipal principal) =>
        principal.FindFirst("preferred_username")?.Value
        ?? principal.FindFirst("upn")?.Value
        ?? principal.FindFirst("unique_name")?.Value
        ?? principal.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name")?.Value
        ?? principal.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value
        ?? principal.FindFirst(System.Security.Claims.ClaimTypes.Upn)?.Value;

    private static string? GetObjectId(ClaimsPrincipal principal) =>
        principal.FindFirst("oid")?.Value
        ?? principal.FindFirst("http://schemas.microsoft.com/identity/claims/objectidentifier")?.Value;

    private static UserInfo MapToUserInfo(User user) => new()
    {
        Id = user.Id,
        Email = user.Email,
        FullName = user.FullName,
        Faculty = user.Faculty,
        Year = user.Year,
        Section = user.Section,
        StudyType = user.StudyType,
        IsAdmin = user.IsAdmin,
        CreatedAt = user.CreatedAt,
        ProfilePhotoUrl = user.ProfilePhotoUrl,
    };
}
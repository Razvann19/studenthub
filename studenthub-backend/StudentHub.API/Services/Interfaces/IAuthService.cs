using System.Security.Claims;
using StudentHub.API.Models.Auth;

namespace StudentHub.API.Services.Interfaces;

public interface IAuthService
{
    Task<SyncResponse> SyncUserAsync(ClaimsPrincipal principal);
    Task<UserInfo> CompleteProfileAsync(ClaimsPrincipal principal, CompleteProfileRequest request);
    Task<UserInfo> GetMeAsync(ClaimsPrincipal principal);
    Task<UserInfo> UpdateProfileAsync(ClaimsPrincipal principal, UpdateProfileRequest request);
}
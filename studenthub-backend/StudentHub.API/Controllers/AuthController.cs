using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudentHub.API.Controllers.Base;
using StudentHub.API.Models.Auth;
using StudentHub.API.Services.Interfaces;

namespace StudentHub.API.Controllers;

[Authorize(AuthenticationSchemes = "Entra")]
public class AuthController : ApiBaseController
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("sync")]
    public async Task<IActionResult> Sync()
    {
        var result = await _authService.SyncUserAsync(User);
        return Success(result);
    }

    [HttpPost("complete-profile")]
    public async Task<IActionResult> CompleteProfile([FromBody] CompleteProfileRequest request)
    {
        var result = await _authService.CompleteProfileAsync(User, request);
        return Success(result);
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetMe()
    {
        var result = await _authService.GetMeAsync(User);
        return Success(result);
    }
    [HttpPut("update-profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        var result = await _authService.UpdateProfileAsync(User, request);
        return Success(result);
    }
}
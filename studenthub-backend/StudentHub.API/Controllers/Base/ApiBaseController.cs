using Microsoft.AspNetCore.Mvc;

namespace StudentHub.API.Controllers.Base;

[ApiController]
[Route("api/[controller]")]
public abstract class ApiBaseController : ControllerBase
{
    protected IActionResult Success(object? data = null, string message = "Success")
        => Ok(new { success = true, message, data });

    protected IActionResult Fail(string message, int statusCode = 400)
        => StatusCode(statusCode, new { success = false, message });
    protected string? GetCurrentUserEmail() =>
        User.FindFirst("preferred_username")?.Value
        ?? User.FindFirst("upn")?.Value
        ?? User.FindFirst("unique_name")?.Value
        ?? User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name")?.Value
        ?? User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value
        ?? User.FindFirst(System.Security.Claims.ClaimTypes.Upn)?.Value;
}
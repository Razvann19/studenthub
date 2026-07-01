using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StudentHub.API.Data;

namespace StudentHub.API.Controllers;

[Route("api/[controller]")]
[ApiController]
public class OnlineController : ControllerBase
{
    private readonly AppDbContext _db;

    public OnlineController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet("platform")]
    public async Task<IActionResult> GetPlatformCount()
    {
        var cutoff = DateTime.UtcNow.AddMinutes(-5);
        var count = await _db.Students
            .CountAsync(u => u.LastSeenAt != null && u.LastSeenAt > cutoff);
        return Ok(new { count });
    }
}
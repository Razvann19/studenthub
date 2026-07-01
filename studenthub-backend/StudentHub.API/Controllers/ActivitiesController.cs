using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StudentHub.API.Controllers.Base;
using StudentHub.API.Data;

namespace StudentHub.API.Controllers;

[Authorize(AuthenticationSchemes = "Entra")]
public class ActivitiesController : ApiBaseController
{
    private readonly AppDbContext _db;
    public ActivitiesController(AppDbContext db) { _db = db; }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var activities = await _db.Activities
            .Where(a => a.IsActive)
            .OrderBy(a => a.Order)
            .Select(a => new { a.Id, a.Name, a.Emoji })
            .ToListAsync();
        return Success(activities);
    }
}
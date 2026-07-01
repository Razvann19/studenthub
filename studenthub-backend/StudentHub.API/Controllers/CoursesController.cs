using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StudentHub.API.Controllers.Base;
using StudentHub.API.Data;

namespace StudentHub.API.Controllers;

[Authorize(AuthenticationSchemes = "Entra")]
public class CoursesController : ApiBaseController
{
    private readonly AppDbContext _db;

    public CoursesController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet("my")]
    public async Task<IActionResult> GetMyCourses()
    {
        var email = GetCurrentUserEmail();
        if (string.IsNullOrEmpty(email))
            return Fail("Neautorizat.", 401);

        var user = await _db.Students
            .FirstOrDefaultAsync(u => u.Email == email.ToLower());

        if (user == null)
            return Fail("Utilizatorul nu a fost găsit.", 404);

        if (string.IsNullOrEmpty(user.Section) || !user.Year.HasValue || string.IsNullOrEmpty(user.StudyType))
            return Success(new List<object>());

        var courses = await _db.Courses
            .Where(c => c.StudyType == user.StudyType &&
                        c.Section == user.Section &&
                        c.Year == user.Year &&
                        c.IsActive)
            .OrderBy(c => c.Order)
            .Select(c => new { c.Id, c.Name, c.ShortName, c.Section, c.Year, c.StudyType })
            .ToListAsync();

        return Success(courses);
    }
}
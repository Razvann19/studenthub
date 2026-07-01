using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StudentHub.API.Controllers.Base;
using StudentHub.API.Data;

namespace StudentHub.API.Controllers;

public class AcademicOptionsController : ApiBaseController
{
    private readonly AppDbContext _db;

    public AcademicOptionsController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet("{studyType}")]
    public async Task<IActionResult> GetByStudyType(string studyType)
    {
        var options = await _db.AcademicOptions
            .Where(a => a.StudyType == studyType && a.IsActive)
            .OrderBy(a => a.Order)
            .Select(a => new
            {
                a.Id,
                a.Value,
                a.Years,
                a.Order
            })
            .ToListAsync();

        return Success(options);
    }
}
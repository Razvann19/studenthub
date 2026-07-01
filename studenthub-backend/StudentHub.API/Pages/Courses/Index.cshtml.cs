using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using StudentHub.API.Data;
using StudentHub.API.Models.Entities;

namespace StudentHub.API.Pages.Courses;

public class IndexModel : PageModel
{
    private readonly AppDbContext _db;

    public IndexModel(AppDbContext db)
    {
        _db = db;
    }

    public List<AcademicOption> LicentaSections { get; set; } = new();
    public List<AcademicOption> MasterSections { get; set; } = new();
    public List<Course> Courses { get; set; } = new();

    [BindProperty(SupportsGet = true)]
    public string? SelectedStudyType { get; set; }

    [BindProperty(SupportsGet = true)]
    public string? SelectedSection { get; set; }

    [BindProperty(SupportsGet = true)]
    public int? SelectedYear { get; set; }

    public AcademicOption? SelectedOption { get; set; }

    public async Task OnGetAsync()
    {
        LicentaSections = await _db.AcademicOptions
            .Where(a => a.StudyType == "licenta" && a.IsActive)
            .OrderBy(a => a.Order)
            .ToListAsync();

        MasterSections = await _db.AcademicOptions
            .Where(a => a.StudyType == "master" && a.IsActive)
            .OrderBy(a => a.Order)
            .ToListAsync();

        if (!string.IsNullOrEmpty(SelectedStudyType) && !string.IsNullOrEmpty(SelectedSection))
        {
            SelectedOption = await _db.AcademicOptions
                .FirstOrDefaultAsync(a => a.StudyType == SelectedStudyType && a.Value == SelectedSection);
        }

        if (!string.IsNullOrEmpty(SelectedSection) && SelectedYear.HasValue)
        {
            Courses = await _db.Courses
                .Where(c => c.StudyType == SelectedStudyType &&
                            c.Section == SelectedSection &&
                            c.Year == SelectedYear)
                .OrderBy(c => c.Order)
                .ToListAsync();
        }
    }

    public async Task<IActionResult> OnPostAddAsync(string studyType, string sectionName, int year, string name, string? shortName)
    {
        if (string.IsNullOrWhiteSpace(name))
            return RedirectToPage(new { SelectedStudyType = studyType, SelectedSection = sectionName, SelectedYear = year });

        var maxOrder = await _db.Courses
            .Where(c => c.StudyType == studyType && c.Section == sectionName && c.Year == year)
            .MaxAsync(c => (int?)c.Order) ?? 0;

        _db.Courses.Add(new Course
        {
            StudyType = studyType,
            Section = sectionName,
            Year = year,
            Name = name.Trim(),
            ShortName = string.IsNullOrWhiteSpace(shortName) ? null : shortName.Trim().ToUpper(),
            Order = maxOrder + 1,
            IsActive = true
        });

        await _db.SaveChangesAsync();
        return RedirectToPage(new { SelectedStudyType = studyType, SelectedSection = sectionName, SelectedYear = year });
    }


    public async Task<IActionResult> OnPostDeleteAsync(int id, string studyType, string sectionName, int year)
    {
        var course = await _db.Courses.FindAsync(id);
        if (course != null)
        {
            _db.Courses.Remove(course);
            await _db.SaveChangesAsync();
        }
        return RedirectToPage(new { SelectedStudyType = studyType, SelectedSection = sectionName, SelectedYear = year });
    }

    public async Task<IActionResult> OnPostEditAsync(int id, string name, string? shortName, string studyType, string sectionName, int year)
    {
        var course = await _db.Courses.FindAsync(id);
        if (course != null)
        {
            course.Name = name.Trim();
            course.ShortName = string.IsNullOrWhiteSpace(shortName) ? null : shortName.Trim().ToUpper();
            await _db.SaveChangesAsync();
        }
        return RedirectToPage(new { SelectedStudyType = studyType, SelectedSection = sectionName, SelectedYear = year });
    }

    public async Task<IActionResult> OnPostReorderAsync(string ids, string studyType, string section, int year)
    {
        var idList = ids.Split(',').Select(int.Parse).ToList();
        var courses = await _db.Courses.Where(c => idList.Contains(c.Id)).ToListAsync();

        for (int i = 0; i < idList.Count; i++)
        {
            var course = courses.FirstOrDefault(c => c.Id == idList[i]);
            if (course != null)
                course.Order = i + 1;
        }

        await _db.SaveChangesAsync();
        return new OkResult();
    }
}
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using StudentHub.API.Data;
using StudentHub.API.Models.Entities;

namespace StudentHub.API.Pages.AcademicOptions;

public class IndexModel : PageModel
{
    private readonly AppDbContext _db;

    public IndexModel(AppDbContext db)
    {
        _db = db;
    }

    public List<AcademicOption> LicentaSections { get; set; } = new();
    public List<AcademicOption> MasterSections { get; set; } = new();

    public async Task OnGetAsync()
    {
        LicentaSections = await _db.AcademicOptions
            .Where(a => a.StudyType == "licenta")
            .OrderBy(a => a.Order)
            .ToListAsync();

        MasterSections = await _db.AcademicOptions
            .Where(a => a.StudyType == "master")
            .OrderBy(a => a.Order)
            .ToListAsync();
    }

    public async Task<IActionResult> OnPostAddAsync(string studyType, string value, int years)
    {
        if (string.IsNullOrWhiteSpace(value))
            return RedirectToPage();

        var maxOrder = await _db.AcademicOptions
            .Where(a => a.StudyType == studyType)
            .MaxAsync(a => (int?)a.Order) ?? 0;

        _db.AcademicOptions.Add(new AcademicOption
        {
            StudyType = studyType,
            Value = value.Trim(),
            Years = years,
            Order = maxOrder + 1,
            IsActive = true
        });

        await _db.SaveChangesAsync();
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostDeleteAsync(int id)
    {
        var option = await _db.AcademicOptions.FindAsync(id);
        if (option != null)
        {
            _db.AcademicOptions.Remove(option);
            await _db.SaveChangesAsync();
        }
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostReorderAsync(string ids)
    {
        var idList = ids.Split(',').Select(int.Parse).ToList();
        var options = await _db.AcademicOptions
            .Where(a => idList.Contains(a.Id))
            .ToListAsync();

        for (int i = 0; i < idList.Count; i++)
        {
            var option = options.FirstOrDefault(a => a.Id == idList[i]);
            if (option != null)
                option.Order = i + 1;
        }

        await _db.SaveChangesAsync();
        return new OkResult();
    }
    public async Task<IActionResult> OnPostEditAsync(int id, string value, int years)
    {
        var option = await _db.AcademicOptions.FindAsync(id);
        if (option == null) return NotFound();

        option.Value = value.Trim();
        option.Years = years;
        await _db.SaveChangesAsync();

        return RedirectToPage();
    }
}
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using StudentHub.API.Data;
using StudentHub.API.Models.Entities;

namespace StudentHub.API.Pages.Activities;

[Authorize(Roles = "Admin")]
public class IndexModel : PageModel
{
    private readonly AppDbContext _db;
    public IndexModel(AppDbContext db) { _db = db; }

    public List<Activity> Activities { get; set; } = new();

    [BindProperty] public string NewName { get; set; } = string.Empty;
    
    [BindProperty] public string? NewEmoji { get; set; }

    public async Task OnGetAsync()
    {
        Activities = await _db.Activities
            .OrderBy(a => a.Order)
            .ToListAsync();
    }

    public async Task<IActionResult> OnPostAddAsync()
    {
        if (string.IsNullOrWhiteSpace(NewName)) return RedirectToPage();

        var maxOrder = await _db.Activities.AnyAsync()
            ? await _db.Activities.MaxAsync(a => a.Order)
            : 0;

        _db.Activities.Add(new Activity
        {
            Name = NewName.Trim(),
            Emoji = string.IsNullOrWhiteSpace(NewEmoji) ? null : NewEmoji.Trim(),
            Order = maxOrder + 1,
            IsActive = true
        });
        await _db.SaveChangesAsync();
        return RedirectToPage();
        
    }

    public async Task<IActionResult> OnPostDeleteAsync(int id)
    {
        var activity = await _db.Activities.FindAsync(id);
        if (activity != null)
        {
            _db.Activities.Remove(activity);
            await _db.SaveChangesAsync();
        }
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostToggleAsync(int id)
    {
        var activity = await _db.Activities.FindAsync(id);
        if (activity != null)
        {
            activity.IsActive = !activity.IsActive;
            await _db.SaveChangesAsync();
        }
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostReorderAsync([FromBody] List<int> ids)
    {
        for (int i = 0; i < ids.Count; i++)
        {
            var activity = await _db.Activities.FindAsync(ids[i]);
            if (activity != null) activity.Order = i + 1;
        }
        await _db.SaveChangesAsync();
        return new JsonResult(new { success = true });
    }

    public async Task<IActionResult> OnPostEditAsync(int id, string name)
    {
        var activity = await _db.Activities.FindAsync(id);
        if (activity != null && !string.IsNullOrWhiteSpace(name))
        {
            activity.Name = name.Trim();
            await _db.SaveChangesAsync();
        }
        return RedirectToPage();
    }
}
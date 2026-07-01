using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using StudentHub.API.Data;
using StudentHub.API.Models.Entities;

namespace StudentHub.API.Pages.ActivityChat;

[Authorize(Roles = "Admin")]
public class IndexModel : PageModel
{
    private readonly AppDbContext _db;
    public IndexModel(AppDbContext db) { _db = db; }

    [BindProperty(SupportsGet = true)] public int? ActivityId { get; set; }
    [BindProperty(SupportsGet = true)] public string? UserFilter { get; set; }
    [BindProperty(SupportsGet = true)] public int PageNumber { get; set; } = 1;

    public const int PageSize = 20;

    public List<Activity> Activities { get; set; } = new();
    public List<Message> Messages { get; set; } = new();
    public int TotalPages { get; set; }
    public Activity? SelectedActivity { get; set; }

    public async Task OnGetAsync()
    {
        Activities = await _db.Activities
            .Where(a => a.IsActive)
            .OrderBy(a => a.Order)
            .ToListAsync();

        if (ActivityId.HasValue)
        {
            SelectedActivity = await _db.Activities.FindAsync(ActivityId.Value);

            var room = $"activity-{ActivityId}";
            var query = _db.Messages.Where(m => m.Room == room);

            if (!string.IsNullOrWhiteSpace(UserFilter))
                query = query.Where(m => m.UserName.Contains(UserFilter) ||
                                         (m.Text != null && m.Text.Contains(UserFilter)));

            var total = await query.CountAsync();
            TotalPages = (int)Math.Ceiling(total / (double)PageSize);

            Messages = await query
                .OrderByDescending(m => m.CreatedAt)
                .Skip((PageNumber - 1) * PageSize)
                .Take(PageSize)
                .ToListAsync();
        }
    }

    public async Task<IActionResult> OnPostDeleteMessageAsync(int messageId)
    {
        var msg = await _db.Messages.FindAsync(messageId);
        if (msg != null)
        {
            var reactions = await _db.MessageReactions.Where(r => r.MessageId == messageId).ToListAsync();
            _db.MessageReactions.RemoveRange(reactions);
            _db.Messages.Remove(msg);
            await _db.SaveChangesAsync();
        }
        return RedirectToPage(new { ActivityId, UserFilter, PageNumber });
    }
}
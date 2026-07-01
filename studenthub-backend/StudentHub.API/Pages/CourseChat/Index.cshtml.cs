using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using StudentHub.API.Data;
using StudentHub.API.Models.Entities;

namespace StudentHub.API.Pages.CourseChat;

[Authorize(Roles = "Admin")]
public class IndexModel : PageModel
{
    private readonly AppDbContext _db;
    public IndexModel(AppDbContext db) { _db = db; }

    // Filtre
    [BindProperty(SupportsGet = true)] public string? Section { get; set; }
    [BindProperty(SupportsGet = true)] public int? Year { get; set; }
    [BindProperty(SupportsGet = true)] public int? CourseId { get; set; }
    [BindProperty(SupportsGet = true)] public string? ActiveTab { get; set; } = "chat";
    [BindProperty(SupportsGet = true)] public string? UserFilter { get; set; }
    [BindProperty(SupportsGet = true)] public int PageNumber { get; set; } = 1;

    public const int PageSize = 20;

    // Date
    public List<string> Sections { get; set; } = new();
    public List<int> Years { get; set; } = new();
    public List<Course> Courses { get; set; } = new();
    public List<Message> Messages { get; set; } = new();
    public List<Note> Notes { get; set; } = new();
    public int TotalPages { get; set; }
    public string? SuccessMessage { get; set; }

    public async Task OnGetAsync()
    {
        // Secții și ani din cursuri active
        Sections = await _db.Courses
            .Where(c => c.IsActive)
            .Select(c => c.Section)
            .Distinct()
            .OrderBy(s => s)
            .ToListAsync();

        if (!string.IsNullOrEmpty(Section))
        {
            Years = await _db.Courses
                .Where(c => c.IsActive && c.Section == Section)
                .Select(c => c.Year)
                .Distinct()
                .OrderBy(y => y)
                .ToListAsync();
        }

        if (!string.IsNullOrEmpty(Section) && Year.HasValue)
        {
            Courses = await _db.Courses
                .Where(c => c.IsActive && c.Section == Section && c.Year == Year)
                .OrderBy(c => c.Order)
                .ToListAsync();
        }

        if (CourseId.HasValue)
        {
            if (ActiveTab == "chat")
            {
                var room = $"course-{CourseId}";
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
            else
            {
                var query = _db.Notes.Where(n => n.CourseId == CourseId);

                if (!string.IsNullOrWhiteSpace(UserFilter))
                    query = query.Where(n => n.UserName.Contains(UserFilter) || 
                                             (n.Text != null && n.Text.Contains(UserFilter)));

                var total = await query.CountAsync();
                TotalPages = (int)Math.Ceiling(total / (double)PageSize);

                Notes = await query
                    .OrderByDescending(n => n.CreatedAt)
                    .Skip((PageNumber - 1) * PageSize)
                    .Take(PageSize)
                    .ToListAsync();
            }
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
        return RedirectToPage(new { Section, Year, CourseId, ActiveTab, UserFilter, PageNumber });
    }

    public async Task<IActionResult> OnPostDeleteNoteAsync(int noteId)
    {
        var note = await _db.Notes.FindAsync(noteId);
        if (note != null)
        {
            var reactions = await _db.NoteReactions.Where(r => r.NoteId == noteId).ToListAsync();
            _db.NoteReactions.RemoveRange(reactions);
            _db.Notes.Remove(note);
            await _db.SaveChangesAsync();
        }
        return RedirectToPage(new { Section, Year, CourseId, ActiveTab, UserFilter, PageNumber });
    }
}
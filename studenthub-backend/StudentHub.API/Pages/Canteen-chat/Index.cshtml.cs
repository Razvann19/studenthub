using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using StudentHub.API.Data;

namespace StudentHub.API.Pages.Canteen_chat;

public class IndexModel : PageModel
{
    private readonly AppDbContext _db;

    public IndexModel(AppDbContext db)
    {
        _db = db;
    }

    public List<MessageDto> Messages { get; set; } = new();
    
    [BindProperty(SupportsGet = true)]
    public string? SearchTerm { get; set; }
    
    [BindProperty(SupportsGet = true)]
    public int PageNumber { get; set; } = 1;
    
    public int PageSize { get; set; } = 20;
    public int TotalPages { get; set; }
    public int TotalMessages { get; set; }

    public async Task OnGetAsync()
    {
        var query = _db.Messages.Where(m => m.Room == "cantina");

        // Căutare
        if (!string.IsNullOrWhiteSpace(SearchTerm))
        {
            var search = SearchTerm.ToLower();
            query = query.Where(m => 
                m.UserName.ToLower().Contains(search) ||
                (m.Text != null && m.Text.ToLower().Contains(search)) ||
                (m.WaitInterval != null && m.WaitInterval.ToLower().Contains(search))
            );
        }

        // Total pentru paginare
        TotalMessages = await query.CountAsync();
        TotalPages = (int)Math.Ceiling(TotalMessages / (double)PageSize);

        // Paginare
        Messages = await query
            .OrderByDescending(m => m.CreatedAt)
            .Skip((PageNumber - 1) * PageSize)
            .Take(PageSize)
            .Select(m => new MessageDto
            {
                Id = m.Id,
                UserName = m.UserName,
                Text = m.Text,
                WaitInterval = m.WaitInterval,
                CreatedAt = m.CreatedAt,
                IsEdited = m.IsEdited,
                ReactionsCount = _db.MessageReactions.Count(r => r.MessageId == m.Id)
            })
            .ToListAsync();
    }

    public async Task<IActionResult> OnPostDeleteAsync(int id)
    {
        await _db.Database.ExecuteSqlRawAsync(
            "DELETE FROM MessageReactions WHERE MessageId = {0}", id);
        
        await _db.Database.ExecuteSqlRawAsync(
            "DELETE FROM Messages WHERE Id = {0}", id);

        return RedirectToPage(new { SearchTerm, PageNumber });
    }

    public class MessageDto
    {
        public int Id { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string? Text { get; set; }
        public string? WaitInterval { get; set; }
        public DateTime CreatedAt { get; set; }
        public bool IsEdited { get; set; }
        public int ReactionsCount { get; set; }
    }
}
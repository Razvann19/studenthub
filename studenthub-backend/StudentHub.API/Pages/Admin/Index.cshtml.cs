using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using StudentHub.API.Data;

namespace StudentHub.API.Pages.Admin;

[Authorize(Roles = "Admin")]
public class IndexModel : PageModel
{
    private readonly AppDbContext _db;
    public IndexModel(AppDbContext db) { _db = db; }

    public int FlaggedCount { get; set; }

    public async Task OnGetAsync()
    {
        FlaggedCount = await _db.Messages
            .CountAsync(m => (m.IsFlagged || m.ReportCount > 0) && !m.IsDeleted);
    }
}
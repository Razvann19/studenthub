using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using StudentHub.API.Data;
using StudentHub.API.Models.Entities;
using StudentHub.API.Services;

namespace StudentHub.API.Pages.BadWords;

[Authorize(Roles = "Admin")]
public class IndexModel : PageModel
{
    private readonly AppDbContext _db;
    private readonly BadWordService _badWordService;

    public List<BadWord> BadWords { get; set; } = new();

    [BindProperty]
    public string NewWord { get; set; } = string.Empty;

    public IndexModel(AppDbContext db, BadWordService badWordService)
    {
        _db = db;
        _badWordService = badWordService;
    }

    public async Task OnGetAsync()
    {
        BadWords = await _db.BadWords.OrderBy(w => w.Word).ToListAsync();
    }

    public async Task<IActionResult> OnPostAddAsync()
    {
        if (!string.IsNullOrWhiteSpace(NewWord))
        {
            var word = NewWord.Trim().ToLower();
            var exists = await _db.BadWords.AnyAsync(w => w.Word == word);
            if (!exists)
            {
                _db.BadWords.Add(new BadWord { Word = word, CreatedAt = DateTime.UtcNow });
                await _db.SaveChangesAsync();
                _badWordService.InvalidateCache();
            }
        }
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostDeleteAsync(int id)
    {
        var word = await _db.BadWords.FindAsync(id);
        if (word != null)
        {
            _db.BadWords.Remove(word);
            await _db.SaveChangesAsync();
            _badWordService.InvalidateCache();
        }
        return RedirectToPage();
    }
}
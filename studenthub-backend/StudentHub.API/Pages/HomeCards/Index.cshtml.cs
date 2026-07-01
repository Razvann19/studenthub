using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using StudentHub.API.Data;
using StudentHub.API.Models.Entities;

namespace StudentHub.API.Pages
{
    [IgnoreAntiforgeryToken]
    [Authorize]
    
    public class IndexModel : PageModel
    {
        private readonly AppDbContext _context;

        public IndexModel(AppDbContext context)
        {
            _context = context;
        }

        public IList<HomeCard> HomeCard { get; set; } = default!;
        public string? Section { get; set; }

        public async Task OnGetAsync(string? section)
        {
            Section = section;
            var query = _context.HomeCards.AsQueryable();

            if (!string.IsNullOrEmpty(section))
                query = query.Where(c => c.Section == section);

            HomeCard = await query.OrderBy(c => c.Order).ToListAsync();
        }
        public async Task<IActionResult> OnPostReorderAsync([FromBody] ReorderRequest request)
        {
            for (int i = 0; i < request.Ids.Count; i++)
            {
                var card = await _context.HomeCards.FindAsync(request.Ids[i]);
                if (card != null) card.Order = i;
            }
            await _context.SaveChangesAsync();
            return new JsonResult(new { success = true });
        }

        public class ReorderRequest
        {
            public List<int> Ids { get; set; } = new();
        }
    }
}
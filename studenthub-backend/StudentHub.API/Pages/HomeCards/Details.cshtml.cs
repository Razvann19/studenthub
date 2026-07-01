using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using StudentHub.API.Data;
using StudentHub.API.Models.Entities;

namespace StudentHub.API.Pages
{
    public class DetailsModel : PageModel
    {
        private readonly StudentHub.API.Data.AppDbContext _context;

        public DetailsModel(StudentHub.API.Data.AppDbContext context)
        {
            _context = context;
        }

        public HomeCard HomeCard { get; set; } = default!;

        public async Task<IActionResult> OnGetAsync(int? id)
        {
            if (id == null)
            {
                return NotFound();
            }

            var homecard = await _context.HomeCards.FirstOrDefaultAsync(m => m.Id == id);

            if (homecard is not null)
            {
                HomeCard = homecard;

                return Page();
            }

            return NotFound();
        }
    }
}

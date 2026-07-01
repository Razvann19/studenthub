using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;
using StudentHub.API.Data;
using StudentHub.API.Models.Entities;

namespace StudentHub.API.Pages
{
    public class EditModel : PageModel
    {
        private readonly StudentHub.API.Data.AppDbContext _context;

        public EditModel(StudentHub.API.Data.AppDbContext context)
        {
            _context = context;
        }

        [BindProperty]
        public HomeCard HomeCard { get; set; } = default!;

        public async Task<IActionResult> OnGetAsync(int? id)
        {
            if (id == null)
            {
                return NotFound();
            }

            var homecard =  await _context.HomeCards.FirstOrDefaultAsync(m => m.Id == id);
            if (homecard == null)
            {
                return NotFound();
            }
            HomeCard = homecard;
            return Page();
        }

        // To protect from overposting attacks, enable the specific properties you want to bind to.
        // For more information, see https://aka.ms/RazorPagesCRUD.
        public async Task<IActionResult> OnPostAsync()
        {
            if (!ModelState.IsValid)
            {
                return Page();
            }

            _context.Attach(HomeCard).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!HomeCardExists(HomeCard.Id))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }

            return RedirectToPage("./Index");
        }

        private bool HomeCardExists(int id)
        {
            return _context.HomeCards.Any(e => e.Id == id);
        }
    }
}

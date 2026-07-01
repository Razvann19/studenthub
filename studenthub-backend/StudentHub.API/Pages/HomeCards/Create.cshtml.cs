using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Mvc.Rendering;
using StudentHub.API.Data;
using StudentHub.API.Models.Entities;

namespace StudentHub.API.Pages
{
    public class CreateModel : PageModel
    {
        private readonly StudentHub.API.Data.AppDbContext _context;

        public CreateModel(StudentHub.API.Data.AppDbContext context)
        {
            _context = context;
        }

        public IActionResult OnGet()
        {
            return Page();
        }

        [BindProperty]
        public HomeCard HomeCard { get; set; } = default!;

        // For more information, see https://aka.ms/RazorPagesCRUD.
        public async Task<IActionResult> OnPostAsync()
        {
            if (!ModelState.IsValid)
            {
                return Page();
            }

            _context.HomeCards.Add(HomeCard);
            await _context.SaveChangesAsync();

            return RedirectToPage("./Index");
        }
    }
}

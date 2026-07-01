using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using StudentHub.API.Data;
using StudentHub.API.Models.Entities;

namespace StudentHub.API.Pages.Students
{
    public class IndexModel : PageModel
    {
        private readonly StudentHub.API.Data.AppDbContext _context;

        public IndexModel(StudentHub.API.Data.AppDbContext context)
        {
            _context = context;
        }

        public new IList<User> User { get; set; } = default!;

        public async Task OnGetAsync()
        {
            User = await _context.Students.ToListAsync();
        }
    }
}

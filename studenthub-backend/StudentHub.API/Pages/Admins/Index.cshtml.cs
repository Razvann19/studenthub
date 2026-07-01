using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace StudentHub.API.Pages.Admins;

[Authorize]
public class IndexModel : PageModel
{
    private readonly UserManager<IdentityUser> _userManager;

    public IndexModel(UserManager<IdentityUser> userManager)
    {
        _userManager = userManager;
    }

    public IList<IdentityUser> Admins { get; set; } = new List<IdentityUser>();

    public async Task OnGetAsync()
    {
        Admins = await _userManager.GetUsersInRoleAsync("Admin");
    }
}
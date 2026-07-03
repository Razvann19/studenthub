using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StudentHub.API.Controllers.Base;
using StudentHub.API.Data;
using StudentHub.API.Models.Auth;
using StudentHub.API.Models.Entities;

namespace StudentHub.API.Controllers;

public class HomeCardController : ApiBaseController
{
    private readonly AppDbContext _db;

    public HomeCardController(AppDbContext db)
    {
        _db = db;
    }
    
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetAll()
    {
        var cards = await _db.HomeCards
            .Where(c => c.IsActive)
            .OrderBy(c => c.Section)
            .ThenBy(c => c.Order)
            .ToListAsync();
        return Success(cards);
    }
    
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Create([FromBody] HomeCardRequest request)
    {
        if (!await IsAdmin()) return Fail("Acces interzis.", 403);

        var card = new HomeCard
        {
            Section = request.Section,
            Icon = request.Icon,
            Title = request.Title,
            Subtitle = request.Subtitle,
            Description = request.Description,
            Color = request.Color,
            Order = request.Order,
        };

        _db.HomeCards.Add(card);
        await _db.SaveChangesAsync();
        return Success(card);
    }

    [HttpPut("{id}")]
    [Authorize]
    public async Task<IActionResult> Update(int id, [FromBody] HomeCardRequest request)
    {
        if (!await IsAdmin()) return Fail("Acces interzis.", 403);

        var card = await _db.HomeCards.FindAsync(id);
        if (card == null) return Fail("Card negăsit.", 404);

        card.Section = request.Section;
        card.Icon = request.Icon;
        card.Title = request.Title;
        card.Subtitle = request.Subtitle;
        card.Description = request.Description;
        card.Color = request.Color;
        card.Order = request.Order;

        await _db.SaveChangesAsync();
        return Success(card);
    }

    [HttpDelete("{id}")]
    [Authorize]
    public async Task<IActionResult> Delete(int id)
    {
        if (!await IsAdmin()) return Fail("Acces interzis.", 403);

        var card = await _db.HomeCards.FindAsync(id);
        if (card == null) return Fail("Card negăsit.", 404);

        _db.HomeCards.Remove(card);
        await _db.SaveChangesAsync();
        return Success();
    }

    [HttpPost("reorder")]
    [Authorize]
    public async Task<IActionResult> Reorder([FromBody] ReorderRequest request)
    {
        if (!await IsAdmin()) return Fail("Acces interzis.", 403);

        for (int i = 0; i < request.Ids.Count; i++)
        {
            var card = await _db.HomeCards.FindAsync(request.Ids[i]);
            if (card != null) card.Order = i;
        }

        await _db.SaveChangesAsync();
        return Success();
    }

    private async Task<bool> IsAdmin()
    {
        var email = User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name")?.Value;
        if (string.IsNullOrEmpty(email)) return false;
        var student = await _db.Students.FirstOrDefaultAsync(u => u.Email == email.ToLower());
        return student?.IsAdmin ?? false;
    }
}
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StudentHub.API.Controllers.Base;
using StudentHub.API.Data;
using StudentHub.API.Models.Entities;
using StudentHub.API.Services;

namespace StudentHub.API.Controllers;

[Authorize(AuthenticationSchemes = "Entra")]
public class MessageReportController : ApiBaseController
{
    private readonly AppDbContext _db;
    private readonly HubUserService _hubUserService;

    public MessageReportController(AppDbContext db, HubUserService hubUserService)
    {
        _db = db;
        _hubUserService = hubUserService;
    }

    [HttpPost("{messageId}")]
    public async Task<IActionResult> Report(int messageId)
    {
        var userId = await _hubUserService.GetUserIdAsync(User);
        if (userId == null) return Unauthorized();

        var message = await _db.Messages.FindAsync(messageId);
        if (message == null) return NotFound();
        
        var existing = await _db.MessageReports
            .FirstOrDefaultAsync(r => r.MessageId == messageId && r.UserId == userId);

        if (existing != null)
            return BadRequest(new { success = false, message = "Ai raportat deja acest mesaj." });

        _db.MessageReports.Add(new MessageReport
        {
            MessageId = messageId,
            UserId = userId.Value,
            CreatedAt = DateTime.UtcNow
        });

        message.ReportCount++;
        await _db.SaveChangesAsync();

        return Success(new { reportCount = message.ReportCount });
    }

    [HttpGet("{messageId}/my-report")]
    public async Task<IActionResult> MyReport(int messageId)
    {
        var userId = await _hubUserService.GetUserIdAsync(User);
        if (userId == null) return Unauthorized();

        var existing = await _db.MessageReports
            .AnyAsync(r => r.MessageId == messageId && r.UserId == userId);

        return Success(existing);
    }
}
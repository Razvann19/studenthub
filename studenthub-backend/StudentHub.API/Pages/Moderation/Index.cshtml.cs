using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using StudentHub.API.Data;
using StudentHub.API.Hubs;
using StudentHub.API.Models.Entities;

namespace StudentHub.API.Pages.Moderation;

[Authorize(Roles = "Admin")]
public class IndexModel : PageModel
{
    private readonly AppDbContext _db;
    private readonly IHubContext<ChatHub> _chatHub;
    private readonly IHubContext<CourseHub> _courseHub;
    private readonly IHubContext<ActivityHub> _activityHub;

    public List<FlaggedMessageViewModel> FlaggedMessages { get; set; } = new();
    public int TotalFlagged { get; set; }

    public IndexModel(AppDbContext db,
        IHubContext<ChatHub> chatHub,
        IHubContext<CourseHub> courseHub,
        IHubContext<ActivityHub> activityHub)
    {
        _db = db;
        _chatHub = chatHub;
        _courseHub = courseHub;
        _activityHub = activityHub;
    }

    public async Task OnGetAsync()
    {
        var messages = await _db.Messages
            .Where(m => (m.IsFlagged || m.ReportCount > 0) && !m.IsDeleted)
            .OrderByDescending(m => m.ReportCount)
            .ThenByDescending(m => m.CreatedAt)
            .ToListAsync();

        var courses = await _db.Courses.ToDictionaryAsync(c => c.Id, c => c.Name);
        var activities = await _db.Activities.ToDictionaryAsync(a => a.Id, a => a.Name);

        FlaggedMessages = messages.Select(m => new FlaggedMessageViewModel
        {
            Id = m.Id,
            Text = !string.IsNullOrEmpty(m.Text) ? m.Text : $"⏱️ Coadă: {m.WaitInterval}",
            UserName = m.UserName,
            Room = m.Room,
            RoomLabel = GetRoomLabel(m.Room, courses, activities),
            CreatedAt = m.CreatedAt,
            IsEdited = m.IsEdited,
            ReportCount = m.ReportCount  
        }).ToList();

        TotalFlagged = FlaggedMessages.Count;
    }

    public async Task<IActionResult> OnPostDeleteAsync(int id)
    {
        var message = await _db.Messages.FindAsync(id);
        if (message != null)
        {
            var room = message.Room;

            var reactions = await _db.MessageReactions.Where(r => r.MessageId == id).ToListAsync();
            _db.MessageReactions.RemoveRange(reactions);
            _db.Messages.Remove(message);
            await _db.SaveChangesAsync();

            if (room == "cantina")
                await _chatHub.Clients.Group(room).SendAsync("MessageDeleted", id);
            else if (room.StartsWith("course-"))
                await _courseHub.Clients.Group(room).SendAsync("MessageDeleted", id);
            else if (room.StartsWith("activity-"))
                await _activityHub.Clients.Group(room).SendAsync("MessageDeleted", id);
        }
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostIgnoreAsync(int id)
    {
        var message = await _db.Messages.FindAsync(id);
        if (message != null)
        {
            message.IsFlagged = false;
            await _db.SaveChangesAsync();
        }
        return RedirectToPage();
    }

    private static string GetRoomLabel(string room, Dictionary<int, string> courses, Dictionary<int, string> activities)
    {
        if (room == "cantina") return "🍽️ Cantină";

        if (room.StartsWith("course-") && int.TryParse(room.Replace("course-", ""), out var courseId))
        {
            var name = courses.TryGetValue(courseId, out var n) ? n : $"#{courseId}";
            return $"📚 {name}";
        }

        if (room.StartsWith("activity-") && int.TryParse(room.Replace("activity-", ""), out var activityId))
        {
            var name = activities.TryGetValue(activityId, out var n) ? n : $"#{activityId}";
            return $"🎯 {name}";
        }

        return room;
    }
}

public class FlaggedMessageViewModel
{
    public int Id { get; set; }
    public string Text { get; set; } = "";
    public string UserName { get; set; } = "";
    public string Room { get; set; } = "";
    public string RoomLabel { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public bool IsEdited { get; set; }
    public int ReportCount { get; set; } 
}
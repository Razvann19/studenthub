using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StudentHub.API.Controllers.Base;
using StudentHub.API.Data;
using StudentHub.API.Models.Entities;

namespace StudentHub.API.Controllers;

[Authorize(AuthenticationSchemes = "Entra")]
public class LastSeenController : ApiBaseController
{
    private readonly AppDbContext _db;

    public LastSeenController(AppDbContext db)
    {
        _db = db;
    }

    // Salvează ultima dată văzută pentru o cameră
    [HttpPost("{roomId}")]
    public async Task<IActionResult> UpdateLastSeen(string roomId)
    {
        var email = GetCurrentUserEmail();
        if (string.IsNullOrEmpty(email)) return Unauthorized();

        var user = await _db.Students.FirstOrDefaultAsync(u => u.Email == email.ToLower());
        if (user == null) return Unauthorized();

        var existing = await _db.UserRoomLastSeen
            .FirstOrDefaultAsync(x => x.UserId == user.Id && x.RoomId == roomId);

        if (existing != null)
        {
            existing.LastSeenAt = DateTime.UtcNow;
        }
        else
        {
            _db.UserRoomLastSeen.Add(new UserRoomLastSeen
            {
                UserId = user.Id,
                RoomId = roomId,
                LastSeenAt = DateTime.UtcNow
            });
        }

        await _db.SaveChangesAsync();
        return Success(true);
    }

    // Returnează numărul de mesaje nevăzute per cameră
   [HttpGet("unread-counts")]
public async Task<IActionResult> GetUnreadCounts()
{
    var email = GetCurrentUserEmail();
    if (string.IsNullOrEmpty(email)) return Unauthorized();

    var user = await _db.Students.FirstOrDefaultAsync(u => u.Email == email.ToLower());
    if (user == null) return Unauthorized();

    var lastSeenList = await _db.UserRoomLastSeen
        .Where(x => x.UserId == user.Id)
        .ToDictionaryAsync(x => x.RoomId, x => x.LastSeenAt);

    var result = new Dictionary<string, int>();

    // O singură query pentru toate mesajele grupate pe room
    var messageCounts = await _db.Messages
        .Where(m => m.UserId != user.Id)
        .GroupBy(m => m.Room)
        .Select(g => new { Room = g.Key, Count = g.Count(), LastMsg = g.Max(m => m.CreatedAt) })
        .ToListAsync();

    foreach (var roomData in messageCounts)
    {
        if (lastSeenList.TryGetValue(roomData.Room, out var lastSeen))
        {
            // Numără doar mesajele după lastSeen
            var unread = await _db.Messages
                .CountAsync(m => m.Room == roomData.Room && m.CreatedAt > lastSeen && m.UserId != user.Id);
            if (unread > 0) result[roomData.Room] = unread;
        }
        else
        {
            // Niciodată văzut — toate mesajele sunt noi
            if (roomData.Count > 0) result[roomData.Room] = roomData.Count;
        }
    }

    // Notițe pentru cursuri
    var courses = await _db.Courses.Select(c => c.Id).ToListAsync();
    foreach (var courseId in courses)
    {
        var roomId = $"course-{courseId}";
        var lastSeen = lastSeenList.TryGetValue(roomId, out var ls) ? ls : (DateTime?)null;

        int noteCount = lastSeen.HasValue
            ? await _db.Notes.CountAsync(n => n.CourseId == courseId && n.CreatedAt > lastSeen && n.UserId != user.Id)
            : await _db.Notes.CountAsync(n => n.CourseId == courseId && n.UserId != user.Id);

        if (noteCount > 0)
            result[roomId] = (result.TryGetValue(roomId, out var existing) ? existing : 0) + noteCount;
    }

    return Success(result);
}
    
    [HttpGet("room-info/{roomId}")]
    public async Task<IActionResult> GetRoomInfo(string roomId)
    {
        var email = GetCurrentUserEmail();
        if (string.IsNullOrEmpty(email)) return Unauthorized(); // ← adaugă

        var user = await _db.Students.FirstOrDefaultAsync(u => u.Email == email.ToLower());
        if (user == null) return Unauthorized();

        var lastSeen = await _db.UserRoomLastSeen
            .FirstOrDefaultAsync(x => x.UserId == user.Id && x.RoomId == roomId);

        return Success(new { lastSeenAt = lastSeen?.LastSeenAt });
    }
}
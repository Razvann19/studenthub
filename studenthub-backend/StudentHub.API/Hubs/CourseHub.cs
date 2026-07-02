using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using StudentHub.API.Data;
using StudentHub.API.Models.Entities;
using StudentHub.API.Services;

namespace StudentHub.API.Hubs;

[Authorize(AuthenticationSchemes = "Entra")]

public class CourseHub : Hub
{
    private readonly AppDbContext _db;
    private readonly NoteIdService _noteIdService;
    private readonly OnlineTracker _tracker;
    private readonly BadWordService _badWordService;
    private readonly HubUserService _hubUserService;

    private static readonly Dictionary<string, (string room, int userId)> _connections = new();
    private static readonly object _connLock = new();

    public CourseHub(AppDbContext db, NoteIdService noteIdService, OnlineTracker tracker, BadWordService badWordService, HubUserService hubUserService)
    {
        _db = db;
        _noteIdService = noteIdService;
        _tracker = tracker;
        _badWordService = badWordService;
        _hubUserService = hubUserService;
    }

    // ── CHAT ──────────────────────────────────────

    public async Task JoinCourse(int courseId, int userId)
    {
        var room = $"course-{courseId}";
        await Groups.AddToGroupAsync(Context.ConnectionId, room);

        lock (_connLock)
            _connections[Context.ConnectionId] = (room, userId);

        _tracker.UserJoinedRoom(room, userId);
        var count = _tracker.GetRoomCount(room);
        await Clients.Group(room).SendAsync("OnlineCountUpdated", count);

        var messages = await _db.Messages
            .Where(m => m.Room == room)
            .OrderBy(m => m.CreatedAt)
            .ToListAsync();

        var reactions = await _db.MessageReactions
            .Where(r => messages.Select(m => m.Id).Contains(r.MessageId))
            .ToListAsync();

        await Clients.Caller.SendAsync("LoadMessages", messages.Select(m => MapMessage(m, reactions)));

        var notes = await _db.Notes
            .Where(n => n.CourseId == courseId)
            .OrderBy(n => n.CreatedAt)
            .ToListAsync();

        var noteReactions = await _db.NoteReactions
            .Where(r => notes.Select(n => n.Id).Contains(r.NoteId))
            .ToListAsync();

        await Clients.Caller.SendAsync("LoadNotes", notes.Select(n => MapNote(n, noteReactions)));
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        string? room = null;
        int userId = 0;

        lock (_connLock)
        {
            if (_connections.TryGetValue(Context.ConnectionId, out var info))
            {
                room = info.room;
                userId = info.userId;
                _connections.Remove(Context.ConnectionId);
            }
        }

        if (room != null && userId != 0)
        {
            _tracker.UserLeftRoom(room, userId);
            var count = _tracker.GetRoomCount(room);
            await Clients.Group(room).SendAsync("OnlineCountUpdated", count);
        }

        await base.OnDisconnectedAsync(exception);
    }

    public async Task SendMessage(int courseId, string? text, int userId, string userName,
        int? replyToId, string? attachmentUrl, string? attachmentName, string? attachmentType)
    {
        var realUserId = await _hubUserService.GetUserIdAsync(Context.User!);
        if (realUserId == null || realUserId != userId) return;

        if (string.IsNullOrWhiteSpace(text) && string.IsNullOrWhiteSpace(attachmentUrl)) return;

        string? replyToUserName = null;
        string? replyToText = null;

        if (replyToId.HasValue)
        {
            var replyMsg = await _db.Messages.FindAsync(replyToId.Value);
            if (replyMsg != null)
            {
                replyToUserName = replyMsg.UserName;
                replyToText = replyMsg.Text;
            }
        }

        var message = new Message
        {
            Room = $"course-{courseId}",
            UserId = realUserId.Value,
            UserName = userName,
            Text = string.IsNullOrWhiteSpace(text) ? null : text.Trim(),
            AttachmentUrl = attachmentUrl,
            AttachmentName = attachmentName,
            AttachmentType = attachmentType,
            CreatedAt = DateTime.UtcNow,
            ReplyToId = replyToId,
            ReplyToUserName = replyToUserName,
            ReplyToText = replyToText,
            IsFlagged = await _badWordService.ContainsBadWordAsync(text),
        };

        _db.Messages.Add(message);
        await _db.SaveChangesAsync();
        await Clients.Group($"course-{courseId}").SendAsync("ReceiveMessage", MapMessage(message, new List<MessageReaction>()));
    }

    public async Task EditMessage(int messageId, string newText, int userId)
    {
        var realUserId = await _hubUserService.GetUserIdAsync(Context.User!);
        if (realUserId == null || realUserId != userId) return;

        var message = await _db.Messages.FindAsync(messageId);
        if (message == null || message.UserId != realUserId) return;

        message.Text = newText.Trim();
        message.IsEdited = true;
        message.IsFlagged = await _badWordService.ContainsBadWordAsync(newText);
        await _db.SaveChangesAsync();

        var courseId = message.Room.Replace("course-", "");
        await Clients.Group($"course-{courseId}").SendAsync("MessageEdited", new { messageId, newText = message.Text });
    }

    public async Task DeleteMessage(int messageId, int userId)
    {
        var realUserId = await _hubUserService.GetUserIdAsync(Context.User!);
        if (realUserId == null || realUserId != userId) return;

        var message = await _db.Messages.FindAsync(messageId);
        if (message == null || message.UserId != realUserId) return;

        var reactions = await _db.MessageReactions.Where(r => r.MessageId == messageId).ToListAsync();
        _db.MessageReactions.RemoveRange(reactions);
        _db.Messages.Remove(message);
        await _db.SaveChangesAsync();

        var courseId = message.Room.Replace("course-", "");
        await Clients.Group($"course-{courseId}").SendAsync("MessageDeleted", messageId);
    }

    public async Task ToggleMessageReaction(int messageId, string emoji, int userId)
    {
        var realUserId = await _hubUserService.GetUserIdAsync(Context.User!);
        if (realUserId == null || realUserId != userId) return;

        var userName = Context.User?.Identity?.Name ?? "Unknown";

        var existing = await _db.MessageReactions
            .Where(r => r.MessageId == messageId && r.UserId == realUserId)
            .ToListAsync();

        if (existing.Any()) _db.MessageReactions.RemoveRange(existing);

        var wasTogglingOff = existing.Any(r => r.Emoji == emoji);
        if (!wasTogglingOff)
        {
            _db.MessageReactions.Add(new MessageReaction
            {
                MessageId = messageId,
                UserId = realUserId.Value,
                UserName = userName,
                Emoji = emoji,
                CreatedAt = DateTime.UtcNow
            });
        }

        await _db.SaveChangesAsync();

        var message = await _db.Messages.FindAsync(messageId);
        var reactions = await _db.MessageReactions
            .Where(r => r.MessageId == messageId)
            .GroupBy(r => r.Emoji)
            .Select(g => new { Emoji = g.Key, Count = g.Count(), Users = g.Select(r => r.UserName).ToList() })
            .ToListAsync();

        await Clients.Group(message!.Room).SendAsync("MessageReactionsUpdated", messageId, reactions);
    }

    // ── NOTES ─────────────────────────────────────

    public async Task AddNote(int courseId, string? text, int userId, string userName,
        string? attachmentUrl, string? attachmentName, string? attachmentType, string? extractedText = null)
    {
        var realUserId = await _hubUserService.GetUserIdAsync(Context.User!);
        if (realUserId == null || realUserId != userId) return;

        if (string.IsNullOrWhiteSpace(text) && string.IsNullOrWhiteSpace(attachmentUrl)) return;

        var note = new Note
        {
            CourseId = courseId,
            UserId = realUserId.Value,
            UserName = userName,
            Text = string.IsNullOrWhiteSpace(text) ? null : text.Trim(),
            AttachmentUrl = attachmentUrl,
            AttachmentName = attachmentName,
            AttachmentType = attachmentType,
            ExtractedText = extractedText,
            NoteId = _noteIdService.Generate(),
            CreatedAt = DateTime.UtcNow
        };

        _db.Notes.Add(note);
        await _db.SaveChangesAsync();

        await Clients.Group($"course-{courseId}").SendAsync("NoteAdded", MapNote(note, new List<NoteReaction>()));
    }

    public async Task EditNote(int noteId, string newText, int userId)
    {
        var realUserId = await _hubUserService.GetUserIdAsync(Context.User!);
        if (realUserId == null || realUserId != userId) return;

        var note = await _db.Notes.FindAsync(noteId);
        if (note == null || note.UserId != realUserId) return;

        note.Text = newText.Trim();
        note.IsEdited = true;
        await _db.SaveChangesAsync();

        await Clients.Group($"course-{note.CourseId}").SendAsync("NoteEdited", new { noteId, newText = note.Text });
    }

    public async Task DeleteNote(int noteId, int userId)
    {
        var realUserId = await _hubUserService.GetUserIdAsync(Context.User!);
        if (realUserId == null || realUserId != userId) return;

        var note = await _db.Notes.FindAsync(noteId);
        if (note == null || note.UserId != realUserId) return;

        var reactions = await _db.NoteReactions.Where(r => r.NoteId == noteId).ToListAsync();
        _db.NoteReactions.RemoveRange(reactions);
        _db.Notes.Remove(note);
        await _db.SaveChangesAsync();

        await Clients.Group($"course-{note.CourseId}").SendAsync("NoteDeleted", noteId);
    }

    public async Task ToggleNoteReaction(int noteId, string emoji, int userId)
    {
        var realUserId = await _hubUserService.GetUserIdAsync(Context.User!);
        if (realUserId == null || realUserId != userId) return;

        var userName = Context.User?.Identity?.Name ?? "Unknown";

        var existing = await _db.NoteReactions
            .Where(r => r.NoteId == noteId && r.UserId == realUserId)
            .ToListAsync();

        if (existing.Any()) _db.NoteReactions.RemoveRange(existing);

        var wasTogglingOff = existing.Any(r => r.Emoji == emoji);
        if (!wasTogglingOff)
        {
            _db.NoteReactions.Add(new NoteReaction
            {
                NoteId = noteId,
                UserId = realUserId.Value,
                UserName = userName,
                Emoji = emoji,
                CreatedAt = DateTime.UtcNow
            });
        }

        await _db.SaveChangesAsync();

        var reactions = await _db.NoteReactions
            .Where(r => r.NoteId == noteId)
            .GroupBy(r => r.Emoji)
            .Select(g => new { Emoji = g.Key, Count = g.Count(), Users = g.Select(r => r.UserName).ToList() })
            .ToListAsync();

        await Clients.Group($"course-{noteId}").SendAsync("NoteReactionsUpdated", noteId, reactions);
    }

    // ── Helpers ───────────────────────────────────

    private static object MapMessage(Message m, List<MessageReaction> allReactions)
    {
        var msgReactions = allReactions
            .Where(r => r.MessageId == m.Id)
            .GroupBy(r => r.Emoji)
            .Select(g => new { emoji = g.Key, count = g.Count(), users = g.Select(r => r.UserName).ToList() })
            .ToList();

        return new
        {
            m.Id, m.UserName, m.Text, m.WaitInterval,
            CreatedAt = m.CreatedAt.ToString("O"),
            m.UserId, m.IsDeleted, m.IsEdited,
            m.ReplyToId, m.ReplyToUserName, m.ReplyToText,
            m.AttachmentUrl, m.AttachmentName, m.AttachmentType,
            m.ReportCount, 
            Reactions = msgReactions,
        };
    }

    private static object MapNote(Note n, List<NoteReaction> allReactions)
    {
        var noteReactions = allReactions
            .Where(r => r.NoteId == n.Id)
            .GroupBy(r => r.Emoji)
            .Select(g => new { emoji = g.Key, count = g.Count(), users = g.Select(r => r.UserName).ToList() })
            .ToList();

        return new
        {
            n.Id, n.NoteId, n.CourseId, n.UserName, n.Text,
            CreatedAt = n.CreatedAt.ToString("O"),
            n.UserId, n.IsEdited,
            n.AttachmentUrl, n.AttachmentName, n.AttachmentType,
            n.ExtractedText,
            Reactions = noteReactions,
        };
    }
}
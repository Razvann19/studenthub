using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using StudentHub.API.Data;
using StudentHub.API.Models.Entities;
using StudentHub.API.Services;

namespace StudentHub.API.Hubs;

[Authorize(AuthenticationSchemes = "Entra")]

public class ChatHub : Hub
{
    private readonly AppDbContext _db;
    private readonly OnlineTracker _tracker;
    private readonly BadWordService _badWordService;
    private readonly HubUserService _hubUserService;

    private static readonly Dictionary<string, (string room, int userId)> _connections = new();
    private static readonly object _connLock = new();

    public ChatHub(AppDbContext db, OnlineTracker tracker, BadWordService badWordService, HubUserService hubUserService)
    {
        _db = db;
        _tracker = tracker;
        _badWordService = badWordService;
        _hubUserService = hubUserService;
    }

    public async Task JoinRoom(string room, int userId)
    {
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

    public async Task SendMessage(string room, string? text, string? waitInterval, int userId, string userName, int? replyToId)
    {
        var realUserId = await _hubUserService.GetUserIdAsync(Context.User!);
        if (realUserId == null || realUserId != userId) return;

        if (string.IsNullOrWhiteSpace(text) && string.IsNullOrWhiteSpace(waitInterval))
            return;

        string? replyToUserName = null;
        string? replyToText = null;

        if (replyToId.HasValue)
        {
            var replyMsg = await _db.Messages.FindAsync(replyToId.Value);
            if (replyMsg != null)
            {
                replyToUserName = replyMsg.UserName;
                replyToText = replyMsg.Text ?? (replyMsg.WaitInterval != null ? $"Coadă: {replyMsg.WaitInterval}" : null);
            }
        }

        var message = new Message
        {
            Room = room,
            UserId = realUserId.Value,
            UserName = userName,
            Text = string.IsNullOrWhiteSpace(text) ? null : text.Trim(),
            WaitInterval = string.IsNullOrWhiteSpace(waitInterval) ? null : waitInterval,
            CreatedAt = DateTime.UtcNow,
            ReplyToId = replyToId,
            ReplyToUserName = replyToUserName,
            ReplyToText = replyToText,
            IsFlagged = await _badWordService.ContainsBadWordAsync(text),
        };

        _db.Messages.Add(message);
        await _db.SaveChangesAsync();

        await Clients.Group(room).SendAsync("ReceiveMessage", MapMessage(message, new List<MessageReaction>()));
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

        await Clients.Group(message.Room).SendAsync("MessageEdited", new
        {
            messageId,
            newText = message.Text,
        });
    }

    public async Task DeleteMessage(int messageId, int userId)
    {
        var realUserId = await _hubUserService.GetUserIdAsync(Context.User!);
        if (realUserId == null || realUserId != userId) return;

        var message = await _db.Messages
            .Include(m => m.User)
            .FirstOrDefaultAsync(m => m.Id == messageId);

        if (message == null || message.UserId != realUserId) return;

        var reactions = await _db.MessageReactions
            .Where(r => r.MessageId == messageId)
            .ToListAsync();
        _db.MessageReactions.RemoveRange(reactions);

        _db.Messages.Remove(message);
        await _db.SaveChangesAsync();

        await Clients.Group(message.Room).SendAsync("MessageDeleted", messageId);
    }

    public async Task ToggleReaction(int messageId, string emoji, int userId, string userName)
    {
        var realUserId = await _hubUserService.GetUserIdAsync(Context.User!);
        if (realUserId == null || realUserId != userId) return;

        var existingReactions = await _db.MessageReactions
            .Where(r => r.MessageId == messageId && r.UserId == realUserId)
            .ToListAsync();

        if (existingReactions.Any())
            _db.MessageReactions.RemoveRange(existingReactions);

        var wasTogglingOff = existingReactions.Any(r => r.Emoji == emoji);

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

        var reactions = await _db.MessageReactions
            .Where(r => r.MessageId == messageId)
            .GroupBy(r => r.Emoji)
            .Select(g => new { Emoji = g.Key, Count = g.Count(), Users = g.Select(r => r.UserName).ToList() })
            .ToListAsync();

        var message = await _db.Messages.FindAsync(messageId);
        await Clients.Group(message!.Room).SendAsync("ReactionsUpdated", messageId, reactions);
    }

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
            m.ReportCount, 
            Reactions = msgReactions,
        };
    }
}
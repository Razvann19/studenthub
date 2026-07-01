using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using StudentHub.API.Data;
using StudentHub.API.Models.Entities;
using StudentHub.API.Services;

namespace StudentHub.API.Hubs;

[Authorize(AuthenticationSchemes = "Entra")]

public class ActivityHub : Hub
{
    private readonly AppDbContext _db;
    private readonly OnlineTracker _tracker;
    private readonly BadWordService _badWordService;
    private readonly HubUserService _hubUserService;

    private static readonly Dictionary<string, (string room, int userId)> _connections = new();
    private static readonly object _connLock = new();

    public ActivityHub(AppDbContext db, OnlineTracker tracker, BadWordService badWordService, HubUserService hubUserService)
    {
        _db = db;
        _tracker = tracker;
        _badWordService = badWordService;
        _hubUserService = hubUserService;
    }

    public async Task JoinActivity(int activityId, int userId)
    {
        var room = $"activity-{activityId}";
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

        var polls = await _db.Polls
            .Include(p => p.Options)
                .ThenInclude(o => o.Votes)
            .Where(p => p.ActivityId == activityId)
            .OrderBy(p => p.CreatedAt)
            .ToListAsync();

        await Clients.Caller.SendAsync("LoadPolls", polls.Select(p => MapPoll(p)));
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

    public async Task SendMessage(int activityId, string? text, int userId, string userName, int? replyToId)
    {
        var realUserId = await _hubUserService.GetUserIdAsync(Context.User!);
        if (realUserId == null || realUserId != userId) return;

        if (string.IsNullOrWhiteSpace(text)) return;

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
            Room = $"activity-{activityId}",
            UserId = realUserId.Value,
            UserName = userName,
            Text = text.Trim(),
            CreatedAt = DateTime.UtcNow,
            ReplyToId = replyToId,
            ReplyToUserName = replyToUserName,
            ReplyToText = replyToText,
            IsFlagged = await _badWordService.ContainsBadWordAsync(text),
        };

        _db.Messages.Add(message);
        await _db.SaveChangesAsync();

        await Clients.Group($"activity-{activityId}").SendAsync("ReceiveMessage", MapMessage(message, new List<MessageReaction>()));
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

        var activityId = message.Room.Replace("activity-", "");
        await Clients.Group($"activity-{activityId}").SendAsync("MessageEdited", new { messageId, newText = message.Text });
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

        var activityId = message.Room.Replace("activity-", "");
        await Clients.Group($"activity-{activityId}").SendAsync("MessageDeleted", messageId);
    }

    public async Task ToggleMessageReaction(int messageId, string emoji, int userId, string userName)
    {
        var realUserId = await _hubUserService.GetUserIdAsync(Context.User!);
        if (realUserId == null || realUserId != userId) return;

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

    public async Task CreatePoll(int activityId, string question, bool allowUserOptions, List<string> options, int userId, string userName)
    {
        var realUserId = await _hubUserService.GetUserIdAsync(Context.User!);
        if (realUserId == null || realUserId != userId) return;

        if (string.IsNullOrWhiteSpace(question) || options.Count < 2) return;

        var poll = new Poll
        {
            ActivityId = activityId,
            UserId = realUserId.Value,
            UserName = userName,
            Question = question.Trim(),
            AllowUserOptions = allowUserOptions,
            CreatedAt = DateTime.UtcNow
        };

        _db.Polls.Add(poll);
        await _db.SaveChangesAsync();

        foreach (var optText in options.Where(o => !string.IsNullOrWhiteSpace(o)))
        {
            _db.PollOptions.Add(new PollOption
            {
                PollId = poll.Id,
                Text = optText.Trim(),
                AddedByUserId = realUserId.Value,
                AddedByUserName = userName,
                CreatedAt = DateTime.UtcNow
            });
        }

        await _db.SaveChangesAsync();

        var fullPoll = await _db.Polls
            .Include(p => p.Options)
                .ThenInclude(o => o.Votes)
            .FirstAsync(p => p.Id == poll.Id);

        await Clients.Group($"activity-{activityId}").SendAsync("PollCreated", MapPoll(fullPoll));
    }

    public async Task EditPoll(int pollId, string newQuestion, int userId)
    {
        var realUserId = await _hubUserService.GetUserIdAsync(Context.User!);
        if (realUserId == null || realUserId != userId) return;

        var poll = await _db.Polls.FindAsync(pollId);
        if (poll == null || poll.UserId != realUserId) return;

        poll.Question = newQuestion.Trim();
        poll.IsEdited = true;
        await _db.SaveChangesAsync();

        await Clients.Group($"activity-{poll.ActivityId}").SendAsync("PollEdited", new { pollId, newQuestion = poll.Question });
    }

    public async Task DeletePoll(int pollId, int userId)
    {
        var realUserId = await _hubUserService.GetUserIdAsync(Context.User!);
        if (realUserId == null || realUserId != userId) return;

        var poll = await _db.Polls
            .Include(p => p.Options)
                .ThenInclude(o => o.Votes)
            .FirstOrDefaultAsync(p => p.Id == pollId);

        if (poll == null || poll.UserId != realUserId) return;

        _db.PollVotes.RemoveRange(poll.Options.SelectMany(o => o.Votes));
        _db.PollOptions.RemoveRange(poll.Options);
        _db.Polls.Remove(poll);
        await _db.SaveChangesAsync();

        await Clients.Group($"activity-{poll.ActivityId}").SendAsync("PollDeleted", pollId);
    }

    public async Task AddPollOption(int pollId, string text, int userId, string userName)
    {
        var realUserId = await _hubUserService.GetUserIdAsync(Context.User!);
        if (realUserId == null || realUserId != userId) return;

        var poll = await _db.Polls.FindAsync(pollId);
        if (poll == null || !poll.AllowUserOptions) return;
        if (string.IsNullOrWhiteSpace(text)) return;

        var option = new PollOption
        {
            PollId = pollId,
            Text = text.Trim(),
            AddedByUserId = realUserId.Value,
            AddedByUserName = userName,
            CreatedAt = DateTime.UtcNow
        };

        _db.PollOptions.Add(option);
        await _db.SaveChangesAsync();

        await Clients.Group($"activity-{poll.ActivityId}").SendAsync("PollOptionAdded", pollId, new
        {
            option.Id,
            option.PollId,
            option.Text,
            option.AddedByUserId,
            option.AddedByUserName,
            Votes = new List<object>()
        });
    }

    public async Task EditPollOption(int optionId, string newText, int userId)
    {
        var realUserId = await _hubUserService.GetUserIdAsync(Context.User!);
        if (realUserId == null || realUserId != userId) return;

        var option = await _db.PollOptions.Include(o => o.Poll).FirstOrDefaultAsync(o => o.Id == optionId);
        if (option == null) return;
        if (option.AddedByUserId != realUserId && option.Poll.UserId != realUserId) return;

        option.Text = newText.Trim();
        await _db.SaveChangesAsync();

        await Clients.Group($"activity-{option.Poll.ActivityId}").SendAsync("PollOptionEdited", new { optionId, newText = option.Text });
    }

    public async Task Vote(int pollId, int optionId, int userId, string userName)
    {
        var realUserId = await _hubUserService.GetUserIdAsync(Context.User!);
        if (realUserId == null || realUserId != userId) return;

        var poll = await _db.Polls.FindAsync(pollId);
        if (poll == null) return;

        var existingVote = await _db.PollVotes
            .FirstOrDefaultAsync(v => v.PollId == pollId && v.UserId == realUserId);

        if (existingVote != null)
        {
            if (existingVote.PollOptionId == optionId)
            {
                _db.PollVotes.Remove(existingVote);
                await _db.SaveChangesAsync();
                var updatedPoll = await GetPollWithVotes(pollId);
                await Clients.Group($"activity-{poll.ActivityId}").SendAsync("PollVotesUpdated", MapPoll(updatedPoll!));
                return;
            }
            _db.PollVotes.Remove(existingVote);
        }

        _db.PollVotes.Add(new PollVote
        {
            PollId = pollId,
            PollOptionId = optionId,
            UserId = realUserId.Value,
            UserName = userName,
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        var finalPoll = await GetPollWithVotes(pollId);
        await Clients.Group($"activity-{poll.ActivityId}").SendAsync("PollVotesUpdated", MapPoll(finalPoll!));
    }

    private async Task<Poll?> GetPollWithVotes(int pollId)
    {
        return await _db.Polls
            .Include(p => p.Options)
                .ThenInclude(o => o.Votes)
            .FirstOrDefaultAsync(p => p.Id == pollId);
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
            m.AttachmentUrl, m.AttachmentName, m.AttachmentType,
            m.ReportCount,
            Reactions = msgReactions,
        };
    }

    private static object MapPoll(Poll p)
    {
        return new
        {
            p.Id, p.ActivityId, p.UserId, p.UserName,
            p.Question, p.AllowUserOptions, p.IsEdited,
            CreatedAt = p.CreatedAt.ToString("O"),
            Options = p.Options.OrderBy(o => o.CreatedAt).Select(o => new
            {
                o.Id, o.PollId, o.Text, o.AddedByUserId, o.AddedByUserName,
                Votes = o.Votes.Select(v => new
                {
                    v.Id, v.UserId, v.UserName,
                    CreatedAt = v.CreatedAt.ToString("O")
                }).ToList()
            }).ToList()
        };
    }
}
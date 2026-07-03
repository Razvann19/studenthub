namespace StudentHub.API.Models.Entities;

public class Message
{
    public int Id { get; set; }
    public string Room { get; set; } = string.Empty;
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string? Text { get; set; }
    public string? WaitInterval { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsDeleted { get; set; } = false;
    public bool IsEdited { get; set; } = false;
    
    public int? ReplyToId { get; set; }
    public string? ReplyToUserName { get; set; }
    public string? ReplyToText { get; set; }

    public User User { get; set; } = null!;
    
    public string? AttachmentUrl { get; set; }
    public string? AttachmentName { get; set; }
    public string? AttachmentType { get; set; }
    
    public int ReportCount { get; set; } = 0;
    public bool IsFlagged { get; set; } = false;
    
    public ICollection<MessageReaction> Reactions { get; set; } = new List<MessageReaction>();

    public ICollection<MessageReport> Reports { get; set; } = new List<MessageReport>();

}
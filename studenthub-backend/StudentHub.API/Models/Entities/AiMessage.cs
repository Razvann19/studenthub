namespace StudentHub.API.Models.Entities;

public class AiMessage
{
    public int Id { get; set; }
    public int ConversationId { get; set; }
    public string Role { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string? AttachmentUrl { get; set; }
    public string? AttachmentName { get; set; }
    public string? AttachmentType { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public AiConversation Conversation { get; set; } = null!;
}
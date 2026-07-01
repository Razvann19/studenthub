namespace StudentHub.API.Models.Entities;

public class AiConversation
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Title { get; set; } = "Conversație nouă";
    public string Category { get; set; } = "general"; // general, mental, notes
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public List<AiMessage> Messages { get; set; } = new();
}
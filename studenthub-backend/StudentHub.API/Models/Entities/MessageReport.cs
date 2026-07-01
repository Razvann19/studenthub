namespace StudentHub.API.Models.Entities;

public class MessageReport
{
    public int Id { get; set; }
    public int MessageId { get; set; }
    public int UserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public Message Message { get; set; } = null!;
    public User User { get; set; } = null!;
}
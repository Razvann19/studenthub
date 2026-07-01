namespace StudentHub.API.Models.Entities;

public class NoteReaction
{
    public int Id { get; set; }
    public int NoteId { get; set; }
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string Emoji { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
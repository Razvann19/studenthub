namespace StudentHub.API.Models.Entities;

public class Note
{
    public int Id { get; set; }
    public int CourseId { get; set; }
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string? Text { get; set; } 
    public bool IsEdited { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public string? AttachmentUrl { get; set; }
    public string? AttachmentName { get; set; }
    public string? AttachmentType { get; set; }
    public Course Course { get; set; } = null!;
    public User User { get; set; } = null!;
    
    public string NoteId { get; set; } = string.Empty;
    
}
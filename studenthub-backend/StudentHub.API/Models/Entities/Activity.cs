namespace StudentHub.API.Models.Entities;

public class Activity
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Order { get; set; } = 0;
    public bool IsActive { get; set; } = true;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public string? Emoji { get; set; }
}
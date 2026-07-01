namespace StudentHub.API.Models.Entities;

public class BadWord
{
    public int Id { get; set; }
    public string Word { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
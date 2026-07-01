namespace StudentHub.API.Models.Entities;

public class User
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? Faculty { get; set; }
    public int? Year { get; set; }
    public string? Section { get; set; }
    public string? StudyType { get; set; }
    public string? EntraObjectId { get; set; }
    public bool IsAdmin { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;
    public string? ProfilePhotoUrl { get; set; }
    public DateTime? LastSeenAt { get; set; }

}
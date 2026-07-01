namespace StudentHub.API.Models.Auth;

public class SyncResponse
{
    public UserInfo User { get; set; } = new();
    public bool IsFirstLogin { get; set; }
}

public class UserInfo
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? Faculty { get; set; }
    public int? Year { get; set; }
    public string? Section { get; set; }
    public string? StudyType { get; set; }
    public bool IsAdmin { get; set; }
    public DateTime CreatedAt { get; set; }

    public string? ProfilePhotoUrl { get; set; }
}
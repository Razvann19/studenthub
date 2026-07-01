namespace StudentHub.API.Models.Auth;

public class CompleteProfileRequest
{
    public string StudyType { get; set; } = string.Empty;
    public string Faculty { get; set; } = string.Empty;
    public int Year { get; set; }
    public string? Section { get; set; }
}
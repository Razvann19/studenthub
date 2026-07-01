namespace StudentHub.API.Models.Auth;

public class UpdateProfileRequest
{
    public string? StudyType { get; set; }
    public string? Faculty { get; set; }
    public int? Year { get; set; }
    public string? Section { get; set; }
}
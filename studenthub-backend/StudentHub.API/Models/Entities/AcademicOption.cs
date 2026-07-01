namespace StudentHub.API.Models.Entities;

public class AcademicOption
{
    public int Id { get; set; }
    public string StudyType { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty; 
    public int Years { get; set; } = 4; 
    public int Order { get; set; }
    public bool IsActive { get; set; } = true;
}
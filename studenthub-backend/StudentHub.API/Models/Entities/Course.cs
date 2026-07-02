namespace StudentHub.API.Models.Entities;

public class Course
{
    public int Id { get; set; }
    public string StudyType { get; set; } = string.Empty;
    public string Section { get; set; } = string.Empty;   
    public int Year { get; set; }                         
    public string Name { get; set; } = string.Empty;      
    public int Order { get; set; }
    public bool IsActive { get; set; } = true;
    public string? ShortName { get; set; }
    
    public int? Semester { get; set; }

}
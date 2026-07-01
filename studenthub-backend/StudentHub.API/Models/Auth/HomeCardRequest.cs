namespace StudentHub.API.Models.Auth;

public class HomeCardRequest
{
    public string Section { get; set; } = string.Empty;
    public string Icon { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Subtitle { get; set; }
    public string Description { get; set; } = string.Empty;
    public string? Color { get; set; }
    public int Order { get; set; }
}

public class ReorderRequest
{
    public List<int> Ids { get; set; } = new();
}
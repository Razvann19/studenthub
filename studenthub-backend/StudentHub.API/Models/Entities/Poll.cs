namespace StudentHub.API.Models.Entities;

public class Poll
{
    public int Id { get; set; }
    public int ActivityId { get; set; }
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string Question { get; set; } = string.Empty;
    public bool AllowUserOptions { get; set; } = false;
    public bool IsEdited { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Activity Activity { get; set; } = null!;
    public List<PollOption> Options { get; set; } = new();
}
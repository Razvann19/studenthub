namespace StudentHub.API.Models.Entities;

public class PollVote
{
    public int Id { get; set; }
    public int PollOptionId { get; set; }
    public int PollId { get; set; }
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public PollOption Option { get; set; } = null!;
}
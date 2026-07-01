namespace StudentHub.API.Models.Entities;

public class PollOption
{
    public int Id { get; set; }
    public int PollId { get; set; }
    public string Text { get; set; } = string.Empty;
    public int AddedByUserId { get; set; }
    public string AddedByUserName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Poll Poll { get; set; } = null!;
    public List<PollVote> Votes { get; set; } = new();
}
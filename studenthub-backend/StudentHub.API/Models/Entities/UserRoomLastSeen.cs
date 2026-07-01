namespace StudentHub.API.Models.Entities;

public class UserRoomLastSeen
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string RoomId { get; set; } = string.Empty;
    public DateTime LastSeenAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
}
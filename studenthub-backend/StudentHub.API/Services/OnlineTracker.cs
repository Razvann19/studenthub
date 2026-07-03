namespace StudentHub.API.Services;

public class OnlineTracker
{
    private readonly Dictionary<string, HashSet<int>> _roomUsers = new();
    private readonly HashSet<int> _platformUsers = new();
    private readonly object _lock = new();

    public void UserJoinedRoom(string room, int userId)
    {
        lock (_lock)
        {
            if (!_roomUsers.ContainsKey(room))
                _roomUsers[room] = new HashSet<int>();
            _roomUsers[room].Add(userId);
            _platformUsers.Add(userId);
        }
    }

    public void UserLeftRoom(string room, int userId)
    {
        lock (_lock)
        {
            if (_roomUsers.ContainsKey(room))
                _roomUsers[room].Remove(userId);
            
            bool stillOnline = _roomUsers.Values.Any(users => users.Contains(userId));
            if (!stillOnline)
                _platformUsers.Remove(userId);
        }
    }

    public int GetRoomCount(string room)
    {
        lock (_lock)
        {
            return _roomUsers.TryGetValue(room, out var users) ? users.Count : 0;
        }
    }

    public int GetPlatformCount()
    {
        lock (_lock) { return _platformUsers.Count; }
    }
}
using Battleship.Core.Protocol;

namespace Battleship.Server.Lobby;

/// <summary>
/// Every connected client, in connection order. Only <c>GameHost</c>'s loop
/// touches it.
/// </summary>
public sealed class Roster
{
    private readonly List<PlayerRecord> _players = new();

    public IReadOnlyList<PlayerRecord> Players => _players;

    /// <summary>Players who have a nickname; only they receive <c>lobby</c>.</summary>
    public IEnumerable<PlayerRecord> Joined => _players.Where(player => player.HasJoined);

    public void Add(PlayerRecord player) => _players.Add(player);

    public void Remove(string id) => _players.RemoveAll(player => player.Id == id);

    public PlayerRecord? Find(string id) => _players.Find(player => player.Id == id);

    public LobbyUpdate BuildLobby() => new()
    {
        Count = _players.Count,
        Clients = _players
            .Select(player => new LobbyClient { Id = player.Id, Name = player.Name, Status = player.Status })
            .ToList(),
    };

    /// <summary>The console line, e.g. <c>Online: 2 — Alice (idle), p2 (connecting)</c>.</summary>
    public string Describe() =>
        $"Online: {_players.Count}" +
        (_players.Count == 0 ? "" : " — " + string.Join(", ", _players.Select(p => $"{p.Name ?? p.Id} ({p.Status})")));
}

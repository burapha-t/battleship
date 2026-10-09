using Battleship.Core.Protocol;

namespace Battleship.Server.Lobby;

/// <summary>
/// One connected client as the server sees it. Status and score live here,
/// not in a match, because they outlive a match (SRV-0).
/// </summary>
public sealed class PlayerRecord
{
    public PlayerRecord(string id, string address, DateTimeOffset connectedAt)
    {
        Id = id;
        Address = address;
        ConnectedAt = connectedAt;
    }

    public string Id { get; }

    /// <summary>The client's IP address, for the dashboard.</summary>
    public string Address { get; }

    public DateTimeOffset ConnectedAt { get; }

    /// <summary>Null until <c>welcome</c>.</summary>
    public string? Name { get; set; }

    /// <summary>One of the <see cref="LobbyStatus"/> values.</summary>
    public string Status { get; set; } = LobbyStatus.Connecting;

    public int Score { get; set; }

    public bool HasJoined => Name != null;
}

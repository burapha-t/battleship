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

    /// <summary>
    /// The account (users.id) once the player has logged in (LOGIN-1); null
    /// for a guest. Only matches between two accounts are saved (DB-2).
    /// </summary>
    public long? UserId { get; set; }

    /// <summary>
    /// The account's saved profile picture (#77), or "" for none. Set at login
    /// and after a saved <c>profileUpdate</c>, both on the game loop; a guest's
    /// stays "". Sent in <c>lobby</c>, <c>matchStart</c> and <c>matchEnd</c>.
    /// </summary>
    public string Avatar { get; set; } = "";

    public bool HasJoined => Name != null;
}

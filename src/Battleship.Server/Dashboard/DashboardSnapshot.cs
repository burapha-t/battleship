namespace Battleship.Server.Dashboard;

/// <summary>
/// What the dashboard shows, copied out of the game loop after every input.
/// Immutable, so the web thread can read it while the loop moves on.
/// </summary>
public sealed record DashboardSnapshot(
    int Count,
    IReadOnlyList<DashboardClient> Clients,
    IReadOnlyList<DashboardMatch> Matches,
    IReadOnlyList<DashboardEvent> Activity)
{
    public static readonly DashboardSnapshot Empty = new(0, [], [], []);
}

/// <summary>One connected client; <see cref="Name"/> is null until it joins.</summary>
public sealed record DashboardClient(
    string Id, string? Name, string Address, string Status, int Score, DateTimeOffset ConnectedAt);

/// <summary>One running or just-finished match.</summary>
public sealed record DashboardMatch(
    string Id,
    string Phase,
    IReadOnlyList<DashboardPlayer> Players,
    string FirstPlayerId,
    bool FirstPickedAtRandom,
    string? ActivePlayerId,
    int TurnNumber,
    string? WinnerId);

public sealed record DashboardPlayer(string Id, string? Name, int Score);

/// <summary>One line of the activity log, newest first in the snapshot.</summary>
public sealed record DashboardEvent(DateTimeOffset Time, string Text);

using Battleship.Core;
using Battleship.Core.Protocol;
using Battleship.Server.Engine;
using Battleship.Server.Host;
using Battleship.Server.Lobby;

namespace Battleship.Server.Tests;

/// <summary>Records what the engine asked of the timer instead of waiting.</summary>
internal sealed class FakeTurnTimer : ITurnTimer
{
    public List<(string MatchId, int TurnNumber)> Started { get; } = new();
    public List<string> Cancelled { get; } = new();

    public void Start(string matchId, int turnNumber) => Started.Add((matchId, turnNumber));

    public void Cancel(string matchId) => Cancelled.Add(matchId);
}

/// <summary>
/// A roster, a fake timer and an engine with a seeded Random, plus shortcuts
/// to get Alice (p1) and Bob (p2) into a match. Alice places <see cref="FleetA"/>,
/// Bob <see cref="FleetB"/>.
/// </summary>
internal sealed class EngineSetup
{
    // Rows 0, 2, 4, 6, columns 0-3.
    public static readonly IReadOnlyList<IReadOnlyList<Coord>> FleetA = Fleet(startRow: 0, startCol: 0);

    // Rows 1, 3, 5, 7, columns 4-7.
    public static readonly IReadOnlyList<IReadOnlyList<Coord>> FleetB = Fleet(startRow: 1, startCol: 4);

    public EngineSetup(int seed = 1)
    {
        Engine = new MatchEngine(Roster, Timer, new Random(seed));
    }

    public Roster Roster { get; } = new();
    public FakeTurnTimer Timer { get; } = new();
    public MatchEngine Engine { get; }

    public PlayerRecord Join(string id, string name)
    {
        var player = new PlayerRecord(id, "127.0.0.1", DateTimeOffset.Now) { Name = name, Status = LobbyStatus.Idle };
        Roster.Add(player);
        return player;
    }

    /// <summary>Alice and Bob join and both press Start game.</summary>
    public Match Pair()
    {
        Join("p1", "Alice");
        Join("p2", "Bob");
        Engine.FindMatch("p1");
        Engine.FindMatch("p2");
        return Engine.Matches.Single();
    }

    /// <summary>Paired, and both have placed: the first turn is on.</summary>
    public Match StartPlaying()
    {
        var match = Pair();
        Engine.Place("p1", FleetA);
        Engine.Place("p2", FleetB);
        return match;
    }

    /// <summary>
    /// Plays the current match to the end: the winner fires at every cell of
    /// the loser's ships, the loser only at the winner's water. Returns the
    /// frames of the last shot.
    /// </summary>
    public IReadOnlyList<Outbound> PlayToWin(string winnerId)
    {
        var match = Engine.Matches.Single();
        string loserId = match.Players.Single(p => p.Id != winnerId).Id;
        var winnerShots = new Queue<Coord>(Cells(loserId == "p1" ? FleetA : FleetB));
        var loserShots = new Queue<Coord>(Water(winnerId == "p1" ? FleetA : FleetB));

        IReadOnlyList<Outbound> last = Array.Empty<Outbound>();
        while (match.Phase == MatchPhase.Playing)
        {
            string active = match.ActivePlayerId!;
            var cell = active == winnerId ? winnerShots.Dequeue() : loserShots.Dequeue();
            last = Engine.Fire(active, cell.Row, cell.Col);
        }
        return last;
    }

    public static IEnumerable<T> Messages<T>(IEnumerable<Outbound> outbounds) =>
        outbounds.Select(outbound => outbound.Message).OfType<T>();

    public static IEnumerable<Coord> Cells(IReadOnlyList<IReadOnlyList<Coord>> fleet) => fleet.SelectMany(ship => ship);

    public static IEnumerable<Coord> Water(IReadOnlyList<IReadOnlyList<Coord>> fleet)
    {
        var ships = Cells(fleet).ToHashSet();
        for (int row = 0; row < GameRules.GridSize; row++)
        {
            for (int col = 0; col < GameRules.GridSize; col++)
            {
                if (!ships.Contains(new Coord(row, col))) yield return new Coord(row, col);
            }
        }
    }

    private static IReadOnlyList<IReadOnlyList<Coord>> Fleet(int startRow, int startCol) =>
        Enumerable.Range(0, GameRules.ShipCount)
            .Select(i => (IReadOnlyList<Coord>)Enumerable.Range(startCol, GameRules.ShipLength)
                .Select(col => new Coord(startRow + 2 * i, col))
                .ToList())
            .ToList();
}

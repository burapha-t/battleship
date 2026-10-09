using Battleship.Core;
using Battleship.Core.Protocol;

namespace Battleship.IntegrationTests;

/// <summary>Steps of a match, driven over the wire by two <see cref="TestClient"/>s.</summary>
internal static class Play
{
    /// <summary>Both press Start game, a first; returns the <c>matchStart</c> (read by both).</summary>
    public static async Task<MatchStart> PairAsync(TestClient a, TestClient b)
    {
        await a.SendAsync(new FindMatch());
        await a.WaitForAsync<LobbyUpdate>(l => l.Clients.Any(c => c.Id == a.Id && c.Status == LobbyStatus.Searching));
        await b.SendAsync(new FindMatch());
        var start = await a.WaitForAsync<MatchStart>();
        await b.WaitForAsync<MatchStart>();
        return start;
    }

    /// <summary>Both place a random fleet; returns the fleets and turn 1 (read by both).</summary>
    public static async Task<(Fleet A, Fleet B, Turn Turn)> PlaceAsync(TestClient a, TestClient b, int seed = 0)
    {
        var fleetA = new Fleet(RandomPlacement.Generate(new Random(seed)));
        var fleetB = new Fleet(RandomPlacement.Generate(new Random(seed + 1)));
        await a.SendAsync(new Place { Ships = fleetA.Ships });
        await b.WaitForAsync<Placed>(p => p.Id == a.Id);
        await b.SendAsync(new Place { Ships = fleetB.Ships });
        var turn = await a.WaitForAsync<Turn>();
        await b.WaitForAsync<Turn>();
        return (fleetA, fleetB, turn);
    }

    /// <summary>
    /// Plays from <paramref name="turn"/> to the end: the winner fires at every
    /// cell of the loser's ships, the loser only at the winner's water.
    /// Returns the <c>matchEnd</c> (read by both).
    /// </summary>
    public static async Task<MatchEnd> PlayToWinAsync(TestClient winner, Fleet winnerFleet, TestClient loser, Fleet loserFleet, Turn turn)
    {
        var winnerShots = new Queue<Coord>(loserFleet.Cells);
        var loserShots = new Queue<Coord>(winnerFleet.Water);
        while (true)
        {
            bool winnerFires = turn.ActivePlayerId == winner.Id;
            var cell = winnerFires ? winnerShots.Dequeue() : loserShots.Dequeue();
            await (winnerFires ? winner : loser).SendAsync(new Fire { Row = cell.Row, Col = cell.Col });

            var shot = await winner.WaitForAsync<FireResult>();
            await loser.WaitForAsync<FireResult>();
            if (shot.AllSunk)
            {
                var end = await winner.NextAsync<MatchEnd>();
                await loser.WaitForAsync<MatchEnd>();
                return end;
            }
            turn = await winner.WaitForAsync<Turn>();
            await loser.WaitForAsync<Turn>();
        }
    }
}

/// <summary>A fleet as sent in <c>place</c>, with its ship cells and water.</summary>
internal sealed class Fleet
{
    public Fleet(IReadOnlyList<IReadOnlyList<Coord>> ships)
    {
        Ships = ships;
        Cells = ships.SelectMany(ship => ship).ToList();
        var taken = Cells.ToHashSet();
        Water = Enumerable.Range(0, GameRules.GridSize * GameRules.GridSize)
            .Select(i => new Coord(i / GameRules.GridSize, i % GameRules.GridSize))
            .Where(cell => !taken.Contains(cell))
            .ToList();
    }

    public IReadOnlyList<IReadOnlyList<Coord>> Ships { get; }
    public IReadOnlyList<Coord> Cells { get; }
    public IReadOnlyList<Coord> Water { get; }
}

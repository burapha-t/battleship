using System.Text.Json;
using Battleship.Core;
using Battleship.Core.Protocol;

namespace Battleship.IntegrationTests;

// QA-4: across a whole match, no frame sent to a player names an opponent
// ship cell that player hasn't hit (protocol.md §7 rule 3).
public class HiddenShipsTests
{
    /// <summary>
    /// Every opponent ship cell the frames name before <paramref name="viewer"/>
    /// hit it. A <c>fireResult</c> whose target is the viewer describes the
    /// viewer's own board, so its cells are skipped.
    /// </summary>
    private static List<string> Leaks(IReadOnlyList<string> frames, string viewer, Fleet opponentFleet)
    {
        var secret = opponentFleet.Cells.ToHashSet();
        var leaks = new List<string>();
        foreach (var frame in frames)
        {
            using var document = JsonDocument.Parse(frame);
            var root = document.RootElement;
            bool isShot = root.GetProperty("type").GetString() == "fireResult";

            // A cell the viewer has just hit is no longer secret, even in this frame.
            if (isShot && root.GetProperty("by").GetString() == viewer && root.GetProperty("result").GetString() == "hit")
                secret.Remove(new Coord(root.GetProperty("row").GetInt32(), root.GetProperty("col").GetInt32()));

            if (isShot && root.GetProperty("target").GetString() == viewer) continue;
            foreach (var cell in CellsIn(root))
            {
                if (secret.Contains(cell)) leaks.Add($"{cell} in {frame}");
            }
        }
        return leaks;
    }

    // Any [r,c] pair and any object with both "row" and "col", anywhere in the frame.
    private static IEnumerable<Coord> CellsIn(JsonElement element)
    {
        if (element.ValueKind == JsonValueKind.Array)
        {
            var items = element.EnumerateArray().ToList();
            if (items.Count == 2 && items.All(i => i.ValueKind == JsonValueKind.Number))
                yield return new Coord(items[0].GetInt32(), items[1].GetInt32());
            foreach (var cell in items.SelectMany(CellsIn)) yield return cell;
        }
        else if (element.ValueKind == JsonValueKind.Object)
        {
            if (element.TryGetProperty("row", out var row) && element.TryGetProperty("col", out var col))
                yield return new Coord(row.GetInt32(), col.GetInt32());
            foreach (var cell in element.EnumerateObject().SelectMany(p => CellsIn(p.Value))) yield return cell;
        }
    }

    [Fact]
    public async Task WholeMatch_NoFrameNamesAnUnhitOpponentShipCell()
    {
        await using var server = await TestServer.StartAsync();
        await using var alice = await server.JoinAsync("Alice");
        await using var bob = await server.JoinAsync("Bob");
        await Play.PairAsync(alice, bob);
        var (fleetA, fleetB, turn) = await Play.PlaceAsync(alice, bob, seed: 3);
        await Play.PlayToWinAsync(alice, fleetA, bob, fleetB, turn);

        Assert.Empty(Leaks(alice.Received, alice.Id, fleetB));
        Assert.Empty(Leaks(bob.Received, bob.Id, fleetA));
        // The loser never hit anything, so nothing of Alice's fleet reached Bob.
        Assert.DoesNotContain(bob.Received, frame => frame.Contains("\"ships\""));
    }

    [Fact]
    public void Checker_CatchesAPlacementSentToTheOpponent()
    {
        var fleet = new Fleet(RandomPlacement.Generate(new Random(1)));
        var leaked = ProtocolJson.Serialize(new Place { Ships = fleet.Ships });

        Assert.Equal(fleet.Cells.Count, Leaks(new[] { leaked }, "p2", fleet).Count);
    }
}

using System.Net.Sockets;
using Battleship.Core;
using Battleship.Core.Protocol;
using Battleship.Server.Host;
using Battleship.Server.Net;

namespace Battleship.Server.Tests;

// SRV-3: the dashboard's activity log says how the opener was chosen.
public class ActivityLogTests
{
    // Both fleets: four ships along rows 0, 2, 4 and 6, columns 0-3.
    private static readonly IReadOnlyList<IReadOnlyList<Coord>> Fleet = new[] { 0, 2, 4, 6 }
        .Select(row => (IReadOnlyList<Coord>)Enumerable.Range(0, 4).Select(col => new Coord(row, col)).ToList())
        .ToList();

    [Fact]
    public async Task MatchStart_SaysWhetherTheOpenerWasRandomOrTheLastWinner()
    {
        var host = new GameHost(TimeSpan.FromHours(1), new Random(1));
        using var stop = new CancellationTokenSource();
        var running = host.RunAsync(stop.Token);

        // Unconnected sockets: the host only queues lines for them.
        foreach (var id in new[] { "p1", "p2" })
            host.Post(new HostInput.Connected(new ClientSession(id, new TcpClient(), host)));
        host.Post(new HostInput.Message("p1", new Join { Nickname = "Alice" }));
        host.Post(new HostInput.Message("p2", new Join { Nickname = "Bob" }));
        host.Post(new HostInput.Message("p1", new FindMatch()));
        host.Post(new HostInput.Message("p2", new FindMatch()));
        host.Post(new HostInput.Message("p1", new Place { Ships = Fleet }));
        host.Post(new HostInput.Message("p2", new Place { Ships = Fleet }));
        await WaitFor(host, () => host.Snapshot.Matches.Any(m => m.Phase == "Playing"));

        // The opener sinks every ship; the other player only fires at rows 1 and 3, which are water.
        string winnerId = host.Snapshot.Matches.Single().FirstPlayerId;
        string loserId = winnerId == "p1" ? "p2" : "p1";
        string winner = winnerId == "p1" ? "Alice" : "Bob";
        var hits = Fleet.SelectMany(ship => ship).ToList();
        var water = new[] { 1, 3 }.SelectMany(row => Enumerable.Range(0, 8).Select(col => new Coord(row, col))).ToList();
        for (int i = 0; i < hits.Count; i++)
        {
            host.Post(new HostInput.Message(winnerId, new Fire { Row = hits[i].Row, Col = hits[i].Col }));
            if (i < hits.Count - 1)
                host.Post(new HostInput.Message(loserId, new Fire { Row = water[i].Row, Col = water[i].Col }));
        }
        host.Post(new HostInput.Message("p1", new Rematch()));
        host.Post(new HostInput.Message("p2", new Rematch()));
        await WaitFor(host, () => host.Snapshot.Activity.Any(e => e.Text.StartsWith("Match m2:")));
        stop.Cancel();
        await running;

        Assert.Contains(host.Snapshot.Activity, e => e.Text == $"Match m1: Alice vs Bob. The server picked {winner} at random to go first");
        Assert.Contains(host.Snapshot.Activity, e => e.Text == $"Match m2: Alice vs Bob. {winner} won the last match, so {winner} goes first");
    }

    private static async Task WaitFor(GameHost host, Func<bool> done)
    {
        var deadline = DateTime.UtcNow.AddSeconds(5);
        while (!done() && DateTime.UtcNow < deadline)
            await Task.Delay(10);
    }
}

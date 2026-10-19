using System.Text.Json;
using Battleship.Core.Protocol;

namespace Battleship.IntegrationTests;

// SRV-2: Home (leave) after a match ends, over real sockets.
public class LeaveFlowTests
{
    [Fact]
    public async Task LeaveAfterMatchEnd_BothIdle_ScoresKept_OpponentToldAndLogged()
    {
        await using var server = await TestServer.StartAsync();
        await using var alice = await server.JoinAsync("Alice");
        await using var bob = await server.JoinAsync("Bob");
        await Play.PairAsync(alice, bob);
        var (fleetA, fleetB, turn) = await Play.PlaceAsync(alice, bob);
        await Play.PlayToWinAsync(alice, fleetA, bob, fleetB, turn);

        // Alice asks for a rematch, Bob goes back to the lobby instead.
        await alice.SendAsync(new Rematch());
        await alice.WaitForAsync<RematchPending>();
        await bob.SendAsync(new Leave());

        Assert.Equal(bob.Id, (await alice.WaitForAsync<OpponentLeft>()).Id);
        var lobby = await alice.WaitForAsync<LobbyUpdate>(l => l.Clients.All(c => c.Status == LobbyStatus.Idle));
        Assert.Equal(2, lobby.Count);
        await bob.WaitForAsync<LobbyUpdate>(l => l.Clients.All(c => c.Status == LobbyStatus.Idle));

        using (var state = JsonDocument.Parse(await server.Dashboard.GetStringAsync("/api/state")))
        {
            var root = state.RootElement;
            Assert.Empty(root.GetProperty("matches").EnumerateArray());
            Assert.Contains(root.GetProperty("activity").EnumerateArray(),
                e => e.GetProperty("text").GetString() == "Bob left match m1 for the lobby");
        }

        // The old rematch request is gone; a new match needs findMatch, and scores carried over.
        await alice.SendAsync(new FindMatch());
        await bob.SendAsync(new FindMatch());
        var start = await alice.WaitForAsync<MatchStart>();
        Assert.Equal("m2", start.MatchId);
        Assert.Equal(1, start.Players.Single(p => p.Id == alice.Id).Score);
        Assert.Equal(0, start.Players.Single(p => p.Id == bob.Id).Score);
    }

    [Fact]
    public async Task LeaveMidBattle_IsRejected()
    {
        await using var server = await TestServer.StartAsync();
        await using var alice = await server.JoinAsync("Alice");
        await using var bob = await server.JoinAsync("Bob");
        await Play.PairAsync(alice, bob);
        await Play.PlaceAsync(alice, bob);

        await alice.SendAsync(new Leave());

        Assert.Equal(ErrorCodes.NotInMatch, (await alice.WaitForAsync<Error>()).Code);
        using var state = JsonDocument.Parse(await server.Dashboard.GetStringAsync("/api/state"));
        Assert.Single(state.RootElement.GetProperty("matches").EnumerateArray());
    }
}

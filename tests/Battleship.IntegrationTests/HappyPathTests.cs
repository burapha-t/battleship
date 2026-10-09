using Battleship.Core;
using Battleship.Core.Protocol;

namespace Battleship.IntegrationTests;

// QA-2: join → match → place → full match → matchEnd → rematch with the winner first.
public class HappyPathTests
{
    [Fact]
    public async Task FullMatch_ThenRematch_WinnerGoesFirst()
    {
        await using var server = await TestServer.StartAsync();
        await using var alice = await server.JoinAsync("Alice");
        await using var bob = await server.JoinAsync("Bob");

        // Pairing: matchStart to both, then one lobby with both placing.
        var start = await Play.PairAsync(alice, bob);
        Assert.Equal("m1", start.MatchId);
        Assert.Equal(new[] { alice.Id, bob.Id }, start.Players.Select(p => p.Id));
        Assert.All(start.Players, p => Assert.Equal(0, p.Score));
        foreach (var client in new[] { alice, bob })
        {
            var lobby = await client.NextAsync<LobbyUpdate>();
            Assert.All(lobby.Clients, c => Assert.Equal(LobbyStatus.Placing, c.Status));
        }

        // Placement: placed to both, then turn 1 for firstPlayerId, then lobby in-match.
        var (fleetA, fleetB, turn) = await Play.PlaceAsync(alice, bob);
        Assert.Equal(start.FirstPlayerId, turn.ActivePlayerId);
        Assert.Equal(1, turn.TurnNumber);
        Assert.Equal(GameRules.TurnSeconds, turn.Seconds);
        var inMatch = await alice.NextAsync<LobbyUpdate>();
        Assert.All(inMatch.Clients, c => Assert.Equal(LobbyStatus.InMatch, c.Status));

        // Bob wins the whole match.
        var end = await Play.PlayToWinAsync(bob, fleetB, alice, fleetA, turn);
        Assert.Equal(bob.Id, end.WinnerId);
        Assert.Equal(new[] { 0, 1 }, end.Players.Select(p => p.Score));

        // Rematch: Alice asks first (rematchPending to both), Bob's request starts m2 with Bob first.
        await alice.SendAsync(new Rematch());
        Assert.Equal(alice.Id, (await alice.NextAsync<RematchPending>()).From);
        Assert.Equal(alice.Id, (await bob.WaitForAsync<RematchPending>()).From);
        await bob.SendAsync(new Rematch());
        var rematch = await alice.NextAsync<MatchStart>();
        Assert.Equal("m2", rematch.MatchId);
        Assert.Equal(bob.Id, rematch.FirstPlayerId);
        Assert.Equal(new[] { 0, 1 }, rematch.Players.Select(p => p.Score));
        Assert.All((await alice.NextAsync<LobbyUpdate>()).Clients, c => Assert.Equal(LobbyStatus.Placing, c.Status));

        await bob.WaitForAsync<MatchStart>();
        var (_, _, firstTurn) = await Play.PlaceAsync(alice, bob, seed: 7);
        Assert.Equal(bob.Id, firstTurn.ActivePlayerId);
        Assert.Equal(1, firstTurn.TurnNumber);
    }

    [Fact]
    public async Task FirstPlayer_VariesAcrossMatches()
    {
        await using var server = await TestServer.StartAsync(random: new Random(12345));
        var firstSearcherWent = new HashSet<bool>();

        for (int i = 0; i < 10; i++)
        {
            await using var a = await server.JoinAsync($"A{i}");
            await using var b = await server.JoinAsync($"B{i}");
            var start = await Play.PairAsync(a, b);
            firstSearcherWent.Add(start.FirstPlayerId == a.Id);
        }

        Assert.Equal(2, firstSearcherWent.Count);
    }
}

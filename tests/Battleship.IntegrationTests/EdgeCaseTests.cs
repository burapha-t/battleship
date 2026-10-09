using System.Text.Json;
using Battleship.Core;
using Battleship.Core.Protocol;

namespace Battleship.IntegrationTests;

// QA-3: turn timeout, RESET mid-match, disconnect mid-match, every error code.
public class EdgeCaseTests
{
    private static async Task<string> ErrorCodeAfter(TestClient client, ProtocolMessage message)
    {
        await client.SendAsync(message);
        return (await client.WaitForAsync<Error>()).Code;
    }

    [Fact]
    public async Task IdlePlayer_IsAutoFiredEveryTurn_AndTheWireStillSays10Seconds()
    {
        await using var server = await TestServer.StartAsync(turnDuration: TimeSpan.FromMilliseconds(200));
        await using var alice = await server.JoinAsync("Alice");
        await using var bob = await server.JoinAsync("Bob");
        await Play.PairAsync(alice, bob);
        var (_, _, turn) = await Play.PlaceAsync(alice, bob);
        Assert.Equal(GameRules.TurnSeconds, turn.Seconds);

        for (int expectedTurn = 1; expectedTurn <= 3; expectedTurn++)
        {
            var shot = await alice.WaitForAsync<FireResult>();
            Assert.True(shot.Auto);
            Assert.Equal(turn.ActivePlayerId, shot.By);

            turn = await alice.WaitForAsync<Turn>();
            Assert.Equal(expectedTurn + 1, turn.TurnNumber);
            Assert.Equal(GameRules.TurnSeconds, turn.Seconds);
            Assert.NotEqual(shot.By, turn.ActivePlayerId);
        }
    }

    [Fact]
    public async Task ResetMidMatch_EveryoneGetsReset_ThenOneLobbyAllIdle_ScoresZero_NobodyPaired()
    {
        await using var server = await TestServer.StartAsync();
        await using var alice = await server.JoinAsync("Alice");
        await using var bob = await server.JoinAsync("Bob");
        await using var carol = await server.JoinAsync("Carol");
        await Play.PairAsync(alice, bob);
        var (fleetA, fleetB, turn) = await Play.PlaceAsync(alice, bob);
        await Play.PlayToWinAsync(alice, fleetA, bob, fleetB, turn);
        await alice.SendAsync(new Rematch());
        await bob.SendAsync(new Rematch());
        await alice.WaitForAsync<MatchStart>(s => s.MatchId == "m2");
        await bob.WaitForAsync<MatchStart>(s => s.MatchId == "m2");
        await carol.SendAsync(new FindMatch()); // Carol is searching when RESET lands
        await carol.WaitForAsync<LobbyUpdate>(l => l.Clients.Single(c => c.Id == carol.Id).Status == LobbyStatus.Searching);

        (await server.Dashboard.PostAsync("/api/reset", null)).EnsureSuccessStatusCode();

        foreach (var client in new[] { alice, bob, carol })
        {
            await client.WaitForAsync<Reset>();
            var lobby = await client.NextAsync<LobbyUpdate>();
            Assert.All(lobby.Clients, c => Assert.Equal(LobbyStatus.Idle, c.Status));
        }

        using (var state = JsonDocument.Parse(await server.Dashboard.GetStringAsync("/api/state")))
        {
            Assert.All(state.RootElement.GetProperty("clients").EnumerateArray(),
                c => Assert.Equal(0, c.GetProperty("score").GetInt32()));
            Assert.Empty(state.RootElement.GetProperty("matches").EnumerateArray());
        }

        // Nobody is paired until two of them press Start game again.
        await alice.SendAsync(new FindMatch());
        await alice.WaitForAsync<LobbyUpdate>(l => l.Clients.Single(c => c.Id == alice.Id).Status == LobbyStatus.Searching);
        await alice.AssertNothingAsync(TimeSpan.FromMilliseconds(300));
        await bob.SendAsync(new FindMatch());
        var start = await alice.WaitForAsync<MatchStart>();
        Assert.Equal("m3", start.MatchId);
        Assert.All(start.Players, p => Assert.Equal(0, p.Score));
    }

    [Fact]
    public async Task DisconnectMidMatch_SurvivorGetsOpponentLeft_GoesIdle_KeepsScore()
    {
        await using var server = await TestServer.StartAsync();
        await using var alice = await server.JoinAsync("Alice");
        var bob = await server.JoinAsync("Bob");
        await Play.PairAsync(alice, bob);
        var (fleetA, fleetB, turn) = await Play.PlaceAsync(alice, bob);
        await Play.PlayToWinAsync(alice, fleetA, bob, fleetB, turn);
        await alice.SendAsync(new Rematch());
        await bob.SendAsync(new Rematch());
        await alice.WaitForAsync<MatchStart>(s => s.MatchId == "m2");

        await bob.DisposeAsync();

        Assert.Equal(bob.Id, (await alice.WaitForAsync<OpponentLeft>()).Id);
        var lobby = await alice.NextAsync<LobbyUpdate>();
        var self = Assert.Single(lobby.Clients);
        Assert.Equal(LobbyStatus.Idle, self.Status);

        // Alice's point from m1 survives into her next match.
        await using var carol = await server.JoinAsync("Carol");
        var start = await Play.PairAsync(alice, carol);
        Assert.Equal(1, start.Players.Single(p => p.Id == alice.Id).Score);
    }

    [Fact]
    public async Task DisconnectWhileSearching_NobodyIsPairedWithTheGhost()
    {
        await using var server = await TestServer.StartAsync();
        var ghost = await server.JoinAsync("Ghost");
        await ghost.SendAsync(new FindMatch());
        await ghost.WaitForAsync<LobbyUpdate>(l => l.Clients.Single().Status == LobbyStatus.Searching);
        await ghost.DisposeAsync();
        await server.WaitUntilAsync(snapshot => snapshot.Count == 0);

        await using var alice = await server.JoinAsync("Alice");
        await alice.SendAsync(new FindMatch());
        await alice.WaitForAsync<LobbyUpdate>(l => l.Clients.Single().Status == LobbyStatus.Searching);

        await alice.AssertNothingAsync(TimeSpan.FromMilliseconds(300));
    }

    [Fact]
    public async Task RepeatFindMatchWhileSearching_IsIgnoredSilently()
    {
        await using var server = await TestServer.StartAsync();
        await using var alice = await server.JoinAsync("Alice");
        await alice.SendAsync(new FindMatch());
        await alice.WaitForAsync<LobbyUpdate>(l => l.Clients.Single().Status == LobbyStatus.Searching);

        await alice.SendAsync(new FindMatch());

        await alice.AssertNothingAsync(TimeSpan.FromMilliseconds(300));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("ABCDEFGHIJKLMNOPQ")]
    public async Task BadNickname_GetsBadNickname_AndCanTryAgain(string nickname)
    {
        await using var server = await TestServer.StartAsync();
        await using var client = await server.ConnectAsync();

        Assert.Equal(ErrorCodes.BadNickname, await ErrorCodeAfter(client, new Join { Nickname = nickname }));

        await client.SendAsync(new Join { Nickname = "Alice" });
        Assert.Equal("Alice", (await client.NextAsync<Welcome>()).Nickname);
    }

    [Fact]
    public async Task SecondJoin_GetsUnknown_AndKeepsTheFirstName()
    {
        await using var server = await TestServer.StartAsync();
        await using var alice = await server.JoinAsync("Alice");

        Assert.Equal(ErrorCodes.Unknown, await ErrorCodeAfter(alice, new Join { Nickname = "Mallory" }));

        await alice.SendAsync(new FindMatch());
        var lobby = await alice.WaitForAsync<LobbyUpdate>(l => l.Clients.Single().Status == LobbyStatus.Searching);
        Assert.Equal("Alice", lobby.Clients.Single().Name);
    }

    [Fact]
    public async Task VerbsInTheWrongState_GetNotInMatch()
    {
        await using var server = await TestServer.StartAsync();
        await using var stranger = await server.ConnectAsync();
        await using var alice = await server.JoinAsync("Alice");

        Assert.Equal(ErrorCodes.NotInMatch, await ErrorCodeAfter(stranger, new FindMatch()));
        Assert.Equal(ErrorCodes.NotInMatch, await ErrorCodeAfter(alice, new Place { Ships = RandomPlacement.Generate(new Random(0)) }));
        Assert.Equal(ErrorCodes.NotInMatch, await ErrorCodeAfter(alice, new Fire { Row = 0, Col = 0 }));
        Assert.Equal(ErrorCodes.NotInMatch, await ErrorCodeAfter(alice, new Rematch()));
    }

    [Fact]
    public async Task InMatchErrors_GetTheirCodes_AndChangeNothing()
    {
        await using var server = await TestServer.StartAsync();
        await using var alice = await server.JoinAsync("Alice");
        await using var bob = await server.JoinAsync("Bob");
        await Play.PairAsync(alice, bob);

        var bent = RandomPlacement.Generate(new Random(0)).ToList();
        bent[0] = new[] { new Coord(0, 0), new Coord(0, 1), new Coord(1, 1), new Coord(1, 2) };
        Assert.Equal(ErrorCodes.InvalidPlacement, await ErrorCodeAfter(alice, new Place { Ships = bent }));
        Assert.Equal(ErrorCodes.NotInMatch, await ErrorCodeAfter(alice, new Fire { Row = 0, Col = 0 }));

        var (_, _, turn) = await Play.PlaceAsync(alice, bob);
        var active = turn.ActivePlayerId == alice.Id ? alice : bob;
        var waiting = active == alice ? bob : alice;

        Assert.Equal(ErrorCodes.NotYourTurn, await ErrorCodeAfter(waiting, new Fire { Row = 0, Col = 0 }));
        Assert.Equal(ErrorCodes.OutOfRange, await ErrorCodeAfter(active, new Fire { Row = 8, Col = 0 }));
        Assert.Equal(ErrorCodes.NotInMatch, await ErrorCodeAfter(active, new Rematch()));

        await active.SendAsync(new Fire { Row = 4, Col = 4 });
        await active.WaitForAsync<Turn>(t => t.TurnNumber == 2);
        await waiting.SendAsync(new Fire { Row = 4, Col = 4 }); // same cell, other board: fine
        var third = await active.WaitForAsync<Turn>(t => t.TurnNumber == 3);
        Assert.Equal(active.Id, third.ActivePlayerId);

        Assert.Equal(ErrorCodes.AlreadyFired, await ErrorCodeAfter(active, new Fire { Row = 4, Col = 4 }));

        // None of the errors moved the game on: it's still turn 3, and a good shot works.
        await active.SendAsync(new Fire { Row = 5, Col = 5 });
        var shot = await active.WaitForAsync<FireResult>();
        Assert.Equal((active.Id, 5, 5), (shot.By, shot.Row, shot.Col));
        Assert.Equal(4, (await active.WaitForAsync<Turn>()).TurnNumber);
    }
}

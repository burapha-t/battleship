using Battleship.Core.Protocol;

namespace Battleship.Server.Tests;

public class MatchmakingTests
{
    [Fact]
    public void FindMatch_MakesAnIdlePlayerSearching()
    {
        var setup = new EngineSetup();
        var alice = setup.Join("p1", "Alice");

        Assert.Empty(setup.Engine.FindMatch("p1"));

        Assert.Equal(LobbyStatus.Searching, alice.Status);
        Assert.Equal(new[] { "p1" }, setup.Engine.Searching);
    }

    [Fact]
    public void IdlePlayer_IsNeverPaired()
    {
        var setup = new EngineSetup();
        setup.Join("p1", "Alice");
        var bob = setup.Join("p2", "Bob");

        setup.Engine.FindMatch("p1");

        Assert.Empty(setup.Engine.Matches);
        Assert.Equal(LobbyStatus.Idle, bob.Status);
    }

    [Fact]
    public void TwoSearchers_ArePaired_BothPlacing_BothGetMatchStart()
    {
        var setup = new EngineSetup();
        var alice = setup.Join("p1", "Alice");
        var bob = setup.Join("p2", "Bob");
        setup.Engine.FindMatch("p1");

        var outbounds = setup.Engine.FindMatch("p2");

        var outbound = Assert.Single(outbounds);
        Assert.Equal(new[] { "p1", "p2" }, outbound.To);
        var start = Assert.IsType<MatchStart>(outbound.Message);
        Assert.Equal("m1", start.MatchId);
        Assert.Equal(new[] { "p1", "p2" }, start.Players.Select(p => p.Id));
        Assert.Equal(LobbyStatus.Placing, alice.Status);
        Assert.Equal(LobbyStatus.Placing, bob.Status);
        Assert.Empty(setup.Engine.Searching);
    }

    [Fact]
    public void RepeatFindMatch_WhileSearching_ChangesNothing()
    {
        var setup = new EngineSetup();
        var alice = setup.Join("p1", "Alice");
        setup.Engine.FindMatch("p1");

        Assert.Empty(setup.Engine.FindMatch("p1"));

        Assert.Equal(new[] { "p1" }, setup.Engine.Searching);
        Assert.Equal(LobbyStatus.Searching, alice.Status);
        Assert.Empty(setup.Engine.Matches);
    }

    [Fact]
    public void FindMatch_MidMatch_GetsNotInMatch()
    {
        var setup = new EngineSetup();
        setup.Pair();

        var error = Assert.IsType<Error>(Assert.Single(setup.Engine.FindMatch("p1")).Message);

        Assert.Equal(ErrorCodes.NotInMatch, error.Code);
        Assert.Single(setup.Engine.Matches);
    }

    [Fact]
    public void FindMatch_BeforeJoining_GetsNotInMatch()
    {
        var setup = new EngineSetup();
        setup.Roster.Add(new Lobby.PlayerRecord("p1", "127.0.0.1", DateTimeOffset.Now));

        var outbound = Assert.Single(setup.Engine.FindMatch("p1"));

        Assert.Equal(ErrorCodes.NotInMatch, Assert.IsType<Error>(outbound.Message).Code);
        Assert.Empty(setup.Engine.Searching);
    }

    [Fact]
    public void ThreeSearchers_MakeOneMatch_TheThirdKeepsWaiting()
    {
        var setup = new EngineSetup();
        setup.Join("p1", "Alice");
        setup.Join("p2", "Bob");
        var carol = setup.Join("p3", "Carol");

        setup.Engine.FindMatch("p1");
        setup.Engine.FindMatch("p2");
        setup.Engine.FindMatch("p3");

        var match = Assert.Single(setup.Engine.Matches);
        Assert.True(match.Has("p1") && match.Has("p2"));
        Assert.Equal(new[] { "p3" }, setup.Engine.Searching);
        Assert.Equal(LobbyStatus.Searching, carol.Status);
    }

    [Fact]
    public void FourthSearcher_IsPairedWithTheThird()
    {
        var setup = new EngineSetup();
        foreach (var id in new[] { "p1", "p2", "p3", "p4" })
        {
            setup.Join(id, id.ToUpperInvariant());
            setup.Engine.FindMatch(id);
        }

        var second = setup.Engine.Matches.Single(m => m.Id == "m2");
        Assert.True(second.Has("p3") && second.Has("p4"));
        Assert.Empty(setup.Engine.Searching);
    }
}

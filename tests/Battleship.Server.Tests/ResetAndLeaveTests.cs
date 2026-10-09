using Battleship.Core.Protocol;
using Battleship.Server.Lobby;

namespace Battleship.Server.Tests;

public class ResetAndLeaveTests
{
    [Fact]
    public void ResetMidMatch_EndsTheMatch_ZeroesScores_MakesEveryoneIdle()
    {
        var setup = new EngineSetup();
        setup.StartPlaying();
        setup.PlayToWin("p1");
        setup.Engine.Rematch("p1");
        setup.Engine.Rematch("p2");
        var match = setup.Engine.Matches.Single();
        setup.Engine.Place("p1", EngineSetup.FleetA);
        setup.Engine.Place("p2", EngineSetup.FleetB);
        var carol = setup.Join("p3", "Carol");
        carol.Score = 3;

        setup.Engine.Reset();

        Assert.Empty(setup.Engine.Matches);
        Assert.All(setup.Roster.Players, p => Assert.Equal(0, p.Score));
        Assert.All(setup.Roster.Players, p => Assert.Equal(LobbyStatus.Idle, p.Status));
        Assert.Contains(match.Id, setup.Timer.Cancelled);
        Assert.Empty(setup.Engine.TurnExpired(match.Id, match.TurnNumber));
    }

    [Fact]
    public void Reset_EmptiesTheSearch()
    {
        var setup = new EngineSetup();
        setup.Join("p1", "Alice");
        setup.Engine.FindMatch("p1");

        setup.Engine.Reset();
        setup.Join("p2", "Bob");
        setup.Engine.FindMatch("p2");

        Assert.Empty(setup.Engine.Matches);
        Assert.Equal(new[] { "p2" }, setup.Engine.Searching);
    }

    [Fact]
    public void Reset_LeavesAClientThatHasNotJoinedConnecting()
    {
        var setup = new EngineSetup();
        var stranger = new PlayerRecord("p1", "127.0.0.1", DateTimeOffset.Now);
        setup.Roster.Add(stranger);

        setup.Engine.Reset();

        Assert.Equal(LobbyStatus.Connecting, stranger.Status);
    }

    [Fact]
    public void PlayerLeftMidMatch_TheOtherGetsOpponentLeft_GoesIdle_KeepsScore()
    {
        var setup = new EngineSetup();
        var match = setup.StartPlaying();
        var bob = setup.Roster.Find("p2")!;
        bob.Score = 2;

        var outbound = Assert.Single(setup.Engine.PlayerLeft("p1"));

        Assert.Equal(new[] { "p2" }, outbound.To);
        Assert.Equal("p1", Assert.IsType<OpponentLeft>(outbound.Message).Id);
        Assert.Equal(LobbyStatus.Idle, bob.Status);
        Assert.Equal(2, bob.Score);
        Assert.Empty(setup.Engine.Matches);
        Assert.Contains(match.Id, setup.Timer.Cancelled);
    }

    [Fact]
    public void PlayerLeftAfterMatchEnd_TheOtherStillGetsOpponentLeft()
    {
        var setup = new EngineSetup();
        setup.StartPlaying();
        setup.PlayToWin("p2");

        var outbound = Assert.Single(setup.Engine.PlayerLeft("p2"));

        Assert.IsType<OpponentLeft>(outbound.Message);
        Assert.Equal(LobbyStatus.Idle, setup.Roster.Find("p1")!.Status);
    }

    [Fact]
    public void PlayerLeftWhileSearching_IsRemovedFromTheSearch()
    {
        var setup = new EngineSetup();
        setup.Join("p1", "Alice");
        setup.Engine.FindMatch("p1");

        Assert.Empty(setup.Engine.PlayerLeft("p1"));
        setup.Roster.Remove("p1");
        setup.Join("p2", "Bob");
        setup.Engine.FindMatch("p2");

        Assert.Empty(setup.Engine.Matches);
        Assert.Equal(new[] { "p2" }, setup.Engine.Searching);
    }

    [Fact]
    public void SurvivorCanSearchAgain()
    {
        var setup = new EngineSetup();
        setup.StartPlaying();
        setup.Engine.PlayerLeft("p1");
        setup.Roster.Remove("p1");
        setup.Join("p3", "Carol");

        setup.Engine.FindMatch("p2");
        setup.Engine.FindMatch("p3");

        Assert.Equal("m2", setup.Engine.Matches.Single().Id);
    }
}

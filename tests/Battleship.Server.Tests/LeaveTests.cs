using Battleship.Core.Protocol;
using Battleship.Server.Engine;
using Battleship.Server.Lobby;

namespace Battleship.Server.Tests;

public class LeaveTests
{
    [Fact]
    public void LeaveAfterMatchEnd_BothGoIdle_KeepScores_TheOtherGetsOpponentLeft()
    {
        var setup = new EngineSetup();
        var match = setup.StartPlaying();
        setup.PlayToWin("p1");

        var outbound = Assert.Single(setup.Engine.Leave("p2"));

        Assert.Equal(new[] { "p1" }, outbound.To);
        Assert.Equal("p2", Assert.IsType<OpponentLeft>(outbound.Message).Id);
        Assert.All(setup.Roster.Players, p => Assert.Equal(LobbyStatus.Idle, p.Status));
        Assert.Equal(1, setup.Roster.Find("p1")!.Score);
        Assert.Equal(0, setup.Roster.Find("p2")!.Score);
        Assert.Empty(setup.Engine.Matches);
        Assert.Contains(match.Id, setup.Timer.Cancelled);
    }

    [Fact]
    public void LeaveAfterARematchRequest_DropsTheRematch()
    {
        var setup = new EngineSetup();
        setup.StartPlaying();
        setup.PlayToWin("p1");
        setup.Engine.Rematch("p1");

        setup.Engine.Leave("p2");
        var error = Assert.IsType<Error>(Assert.Single(setup.Engine.Rematch("p1")).Message);

        Assert.Equal(ErrorCodes.NotInMatch, error.Code);
        Assert.Empty(setup.Engine.Matches);
    }

    // The opponent's rematch started a new match just as this player pressed Home.
    [Fact]
    public void LeaveWhilePlacingARematch_EndsIt_BothIdle()
    {
        var setup = new EngineSetup();
        setup.StartPlaying();
        setup.PlayToWin("p1");
        setup.Engine.Rematch("p1");
        setup.Engine.Rematch("p2");
        Assert.Equal(MatchPhase.Placing, setup.Engine.Matches.Single().Phase);

        var outbound = Assert.Single(setup.Engine.Leave("p2"));

        Assert.Equal("p2", Assert.IsType<OpponentLeft>(outbound.Message).Id);
        Assert.Empty(setup.Engine.Matches);
        Assert.All(setup.Roster.Players, p => Assert.Equal(LobbyStatus.Idle, p.Status));
        Assert.Equal(1, setup.Roster.Find("p1")!.Score);
    }

    [Fact]
    public void BothPressHome_TheSecondLeaveIsIgnored()
    {
        var setup = new EngineSetup();
        setup.StartPlaying();
        setup.PlayToWin("p1");

        setup.Engine.Leave("p1");

        Assert.Empty(setup.Engine.Leave("p2"));
        Assert.Equal(LobbyStatus.Idle, setup.Roster.Find("p2")!.Status);
    }

    [Fact]
    public void BothCanSearchAgainAfterLeaving()
    {
        var setup = new EngineSetup();
        setup.StartPlaying();
        setup.PlayToWin("p2");
        setup.Engine.Leave("p1");

        setup.Engine.FindMatch("p1");
        setup.Engine.FindMatch("p2");

        Assert.Equal("m2", setup.Engine.Matches.Single().Id);
    }

    [Fact]
    public void LeaveMidMatch_GetsNotInMatch_AndTheMatchGoesOn()
    {
        var setup = new EngineSetup();
        setup.StartPlaying();

        var outbound = Assert.Single(setup.Engine.Leave("p1"));

        Assert.Equal(new[] { "p1" }, outbound.To);
        Assert.Equal(ErrorCodes.NotInMatch, Assert.IsType<Error>(outbound.Message).Code);
        Assert.Single(setup.Engine.Matches);
        Assert.All(setup.Roster.Players, p => Assert.Equal(LobbyStatus.InMatch, p.Status));
    }

    [Fact]
    public void LeaveWhileSearching_GetsNotInMatch_AndKeepsSearching()
    {
        var setup = new EngineSetup();
        setup.Join("p1", "Alice");
        setup.Engine.FindMatch("p1");

        var error = Assert.IsType<Error>(Assert.Single(setup.Engine.Leave("p1")).Message);

        Assert.Equal(ErrorCodes.NotInMatch, error.Code);
        Assert.Equal(new[] { "p1" }, setup.Engine.Searching);
    }

    [Fact]
    public void LeaveFromTheLobby_IsIgnored()
    {
        var setup = new EngineSetup();
        setup.Join("p1", "Alice");

        Assert.Empty(setup.Engine.Leave("p1"));
        Assert.Equal(LobbyStatus.Idle, setup.Roster.Find("p1")!.Status);
    }
}

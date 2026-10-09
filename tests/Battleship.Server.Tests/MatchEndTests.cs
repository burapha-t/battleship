using Battleship.Core.Protocol;
using Battleship.Server.Engine;
using static Battleship.Server.Tests.EngineSetup;

namespace Battleship.Server.Tests;

public class MatchEndTests
{
    [Fact]
    public void LastShipSunk_SendsMatchEndToBoth_WithTheWinnerAndPlusOne()
    {
        var setup = new EngineSetup();
        var match = setup.StartPlaying();

        var last = setup.PlayToWin("p1");

        Assert.Equal(new[] { "p1", "p2" }, last[1].To);
        var end = Assert.IsType<MatchEnd>(last[1].Message);
        Assert.Equal(match.Id, end.MatchId);
        Assert.Equal("p1", end.WinnerId);
        Assert.Collection(end.Players,
            p => { Assert.Equal("p1", p.Id); Assert.Equal(1, p.Score); },
            p => { Assert.Equal("p2", p.Id); Assert.Equal(0, p.Score); });
        Assert.Equal(MatchPhase.MatchEnd, match.Phase);
        Assert.Equal("p1", match.WinnerId);
    }

    [Fact]
    public void ScoreIsStoredOnTheRosterRecord()
    {
        var setup = new EngineSetup();
        setup.StartPlaying();

        setup.PlayToWin("p2");

        Assert.Equal(0, setup.Roster.Find("p1")!.Score);
        Assert.Equal(1, setup.Roster.Find("p2")!.Score);
    }

    [Fact]
    public void PlayersStayInMatch_AfterMatchEnd()
    {
        var setup = new EngineSetup();
        var match = setup.StartPlaying();

        setup.PlayToWin("p1");

        Assert.All(match.Players, p => Assert.Equal(LobbyStatus.InMatch, p.Status));
    }

    [Fact]
    public void MatchEnd_CancelsTheTurnTimer()
    {
        var setup = new EngineSetup();
        var match = setup.StartPlaying();

        setup.PlayToWin("p1");

        Assert.Contains(match.Id, setup.Timer.Cancelled);
        Assert.Empty(setup.Engine.TurnExpired(match.Id, match.TurnNumber));
    }

    [Fact]
    public void FireAfterTheEnd_GetsNotInMatch()
    {
        var setup = new EngineSetup();
        setup.StartPlaying();
        setup.PlayToWin("p1");

        var error = Assert.IsType<Error>(Assert.Single(setup.Engine.Fire("p2", 7, 7)).Message);

        Assert.Equal(ErrorCodes.NotInMatch, error.Code);
    }

    [Fact]
    public void ScoresCarryIntoTheNextMatchStart()
    {
        var setup = new EngineSetup();
        setup.StartPlaying();
        setup.PlayToWin("p2");
        setup.Engine.Rematch("p1");

        var start = Messages<MatchStart>(setup.Engine.Rematch("p2")).Single();

        Assert.Equal(new[] { 0, 1 }, start.Players.Select(p => p.Score));
    }
}

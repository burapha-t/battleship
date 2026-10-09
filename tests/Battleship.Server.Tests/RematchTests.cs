using Battleship.Core.Protocol;
using Battleship.Server.Engine;
using static Battleship.Server.Tests.EngineSetup;

namespace Battleship.Server.Tests;

public class RematchTests
{
    private static EngineSetup FinishedMatch(string winnerId)
    {
        var setup = new EngineSetup();
        setup.StartPlaying();
        setup.PlayToWin(winnerId);
        return setup;
    }

    [Theory]
    [InlineData("p1")]
    [InlineData("p2")]
    public void TheWinner_IsFirstPlayerInTheRematch(string winnerId)
    {
        var setup = FinishedMatch(winnerId);
        setup.Engine.Rematch("p1");

        var start = Messages<MatchStart>(setup.Engine.Rematch("p2")).Single();

        Assert.Equal(winnerId, start.FirstPlayerId);
        Assert.False(setup.Engine.Matches.Single().FirstPickedAtRandom);
    }

    [Fact]
    public void FirstRequest_SendsRematchPendingToBoth()
    {
        var setup = FinishedMatch("p1");

        var outbound = Assert.Single(setup.Engine.Rematch("p2"));

        Assert.Equal(new[] { "p1", "p2" }, outbound.To);
        Assert.Equal("p2", Assert.IsType<RematchPending>(outbound.Message).From);
    }

    [Fact]
    public void DoubleRequestFromOnePlayer_ChangesNothing()
    {
        var setup = FinishedMatch("p1");
        var match = setup.Engine.Matches.Single();
        setup.Engine.Rematch("p2");

        Assert.Empty(setup.Engine.Rematch("p2"));

        Assert.Same(match, setup.Engine.Matches.Single());
        Assert.False(match.BothWantRematch);
    }

    [Fact]
    public void Rematch_HasANewMatchId_StartsPlacing_AndStartsAtTurnOne()
    {
        var setup = FinishedMatch("p1");
        setup.Engine.Rematch("p1");

        var outbounds = setup.Engine.Rematch("p2");

        var start = Messages<MatchStart>(outbounds).Single();
        Assert.Empty(Messages<RematchPending>(outbounds));
        var rematch = setup.Engine.Matches.Single();
        Assert.Equal("m2", start.MatchId);
        Assert.Equal("m2", rematch.Id);
        Assert.Equal(MatchPhase.Placing, rematch.Phase);
        Assert.All(rematch.Players, p => Assert.Equal(LobbyStatus.Placing, p.Status));

        setup.Engine.Place("p1", FleetA);
        var turn = Messages<Turn>(setup.Engine.Place("p2", FleetB)).Single();
        Assert.Equal(1, turn.TurnNumber);
        Assert.Equal("p1", turn.ActivePlayerId);
    }

    [Fact]
    public void RematchBeforeTheEnd_GetsNotInMatch()
    {
        var setup = new EngineSetup();
        setup.StartPlaying();

        var error = Assert.IsType<Error>(Assert.Single(setup.Engine.Rematch("p1")).Message);

        Assert.Equal(ErrorCodes.NotInMatch, error.Code);
    }

    [Fact]
    public void RematchWithoutAMatch_GetsNotInMatch()
    {
        var setup = new EngineSetup();
        setup.Join("p3", "Carol");

        var error = Assert.IsType<Error>(Assert.Single(setup.Engine.Rematch("p3")).Message);

        Assert.Equal(ErrorCodes.NotInMatch, error.Code);
    }
}

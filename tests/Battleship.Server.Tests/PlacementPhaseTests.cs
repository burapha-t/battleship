using Battleship.Core;
using Battleship.Core.Protocol;
using Battleship.Server.Engine;
using static Battleship.Server.Tests.EngineSetup;

namespace Battleship.Server.Tests;

public class PlacementPhaseTests
{
    [Fact]
    public void ValidPlacement_SendsPlacedWithOnlyTheId_ToBoth()
    {
        var setup = new EngineSetup();
        setup.Pair();

        var outbound = Assert.Single(setup.Engine.Place("p1", FleetA));

        Assert.Equal(new[] { "p1", "p2" }, outbound.To);
        Assert.Equal("{\"type\":\"placed\",\"id\":\"p1\"}", ProtocolJson.Serialize(outbound.Message));
    }

    [Fact]
    public void BadPlacement_GetsInvalidPlacement_WithTheReason_AndStaysPlacing()
    {
        var setup = new EngineSetup();
        var match = setup.Pair();
        var bent = FleetA.ToList();
        bent[1] = new[] { new Coord(2, 0), new Coord(2, 1), new Coord(2, 2), new Coord(3, 2) };

        var outbound = Assert.Single(setup.Engine.Place("p1", bent));

        Assert.Equal(new[] { "p1" }, outbound.To);
        var error = Assert.IsType<Error>(outbound.Message);
        Assert.Equal(ErrorCodes.InvalidPlacement, error.Code);
        Assert.Equal("Ship 2 is not in a straight line.", error.Message);
        Assert.Equal(MatchPhase.Placing, match.Phase);
        Assert.Single(setup.Engine.Place("p1", FleetA).Select(o => o.Message).OfType<Placed>());
    }

    [Fact]
    public void SecondValidPlacement_StartsTurnOneForTheFirstPlayer()
    {
        var setup = new EngineSetup();
        var match = setup.Pair();
        setup.Engine.Place("p2", FleetB);

        var outbounds = setup.Engine.Place("p1", FleetA);

        Assert.IsType<Placed>(outbounds[0].Message);
        var turn = Assert.IsType<Turn>(outbounds[1].Message);
        Assert.Equal(new[] { "p1", "p2" }, outbounds[1].To);
        Assert.Equal(match.FirstPlayerId, turn.ActivePlayerId);
        Assert.Equal(GameRules.TurnSeconds, turn.Seconds);
        Assert.Equal(1, turn.TurnNumber);
        Assert.Equal(MatchPhase.Playing, match.Phase);
        Assert.Equal((match.Id, 1), Assert.Single(setup.Timer.Started));
    }

    [Fact]
    public void FirstTurn_PutsBothPlayersInMatch()
    {
        var setup = new EngineSetup();
        var match = setup.Pair();
        setup.Engine.Place("p1", FleetA);
        Assert.All(match.Players, p => Assert.Equal(LobbyStatus.Placing, p.Status));

        setup.Engine.Place("p2", FleetB);

        Assert.All(match.Players, p => Assert.Equal(LobbyStatus.InMatch, p.Status));
    }

    [Fact]
    public void NoMessageToTheOpponent_ContainsThePlacedCells()
    {
        var setup = new EngineSetup();
        setup.Pair();

        var outbounds = setup.Engine.Place("p1", FleetA).Concat(setup.Engine.Place("p2", FleetB));

        foreach (var outbound in outbounds.Where(o => o.To.Contains("p2")))
        {
            string json = ProtocolJson.Serialize(outbound.Message);
            foreach (var cell in Cells(FleetA))
                Assert.DoesNotContain($"[{cell.Row},{cell.Col}]", json);
        }
    }

    [Fact]
    public void PlacingTwice_GetsNotInMatch()
    {
        var setup = new EngineSetup();
        setup.Pair();
        setup.Engine.Place("p1", FleetA);

        var outbound = Assert.Single(setup.Engine.Place("p1", FleetA));

        Assert.Equal(ErrorCodes.NotInMatch, Assert.IsType<Error>(outbound.Message).Code);
    }

    [Fact]
    public void PlacingWithoutAMatch_GetsNotInMatch()
    {
        var setup = new EngineSetup();
        setup.Join("p1", "Alice");

        var outbound = Assert.Single(setup.Engine.Place("p1", FleetA));

        Assert.Equal(ErrorCodes.NotInMatch, Assert.IsType<Error>(outbound.Message).Code);
    }
}

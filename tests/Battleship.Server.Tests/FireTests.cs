using Battleship.Core.Protocol;
using Battleship.Server.Engine;
using static Battleship.Server.Tests.EngineSetup;

namespace Battleship.Server.Tests;

public class FireTests
{
    private static string Other(Match match) => match.Players.Single(p => p.Id != match.ActivePlayerId).Id;

    private static void AssertError(string code, IReadOnlyList<Host.Outbound> outbounds, string to)
    {
        var outbound = Assert.Single(outbounds);
        Assert.Equal(new[] { to }, outbound.To);
        Assert.Equal(code, Assert.IsType<Error>(outbound.Message).Code);
    }

    [Fact]
    public void FireWithoutAMatch_GetsNotInMatch()
    {
        var setup = new EngineSetup();
        setup.Join("p3", "Carol");

        AssertError(ErrorCodes.NotInMatch, setup.Engine.Fire("p3", 0, 0), "p3");
    }

    [Fact]
    public void FireWhilePlacing_GetsNotInMatch()
    {
        var setup = new EngineSetup();
        setup.Pair();

        AssertError(ErrorCodes.NotInMatch, setup.Engine.Fire("p1", 0, 0), "p1");
    }

    [Fact]
    public void FireOutOfTurn_GetsNotYourTurn_AndChangesNothing()
    {
        var setup = new EngineSetup();
        var match = setup.StartPlaying();
        string waiting = Other(match);

        AssertError(ErrorCodes.NotYourTurn, setup.Engine.Fire(waiting, 0, 0), waiting);

        Assert.Equal(1, match.TurnNumber);
        Assert.NotEqual(waiting, match.ActivePlayerId);
        Assert.Empty(match.Moves);
    }

    [Theory]
    [InlineData(8, 0)]
    [InlineData(0, 8)]
    [InlineData(-1, 3)]
    [InlineData(3, -1)]
    public void FireOffTheGrid_GetsOutOfRange(int row, int col)
    {
        var setup = new EngineSetup();
        var match = setup.StartPlaying();
        string active = match.ActivePlayerId!;

        AssertError(ErrorCodes.OutOfRange, setup.Engine.Fire(active, row, col), active);

        Assert.Equal(active, match.ActivePlayerId);
        Assert.Equal(1, match.TurnNumber);
    }

    [Fact]
    public void FireAtTheSameCellAgain_GetsAlreadyFired()
    {
        var setup = new EngineSetup();
        var match = setup.StartPlaying();
        string first = match.ActivePlayerId!;
        setup.Engine.Fire(first, 3, 3);
        setup.Engine.Fire(match.ActivePlayerId!, 3, 3); // same cell on the other board: allowed

        AssertError(ErrorCodes.AlreadyFired, setup.Engine.Fire(first, 3, 3), first);

        Assert.Equal(3, match.TurnNumber);
        Assert.Equal(2, match.Moves.Count);
    }

    [Fact]
    public void Miss_SendsFireResultToBoth_ThenTheOtherPlayersTurn()
    {
        var setup = new EngineSetup();
        var match = setup.StartPlaying();
        string by = match.ActivePlayerId!;
        string target = Other(match);
        var water = Water(target == "p1" ? FleetA : FleetB).First();

        var outbounds = setup.Engine.Fire(by, water.Row, water.Col);

        Assert.Equal(2, outbounds.Count);
        Assert.Equal(new[] { "p1", "p2" }, outbounds[0].To);
        Assert.Equal(
            $"{{\"type\":\"fireResult\",\"by\":\"{by}\",\"target\":\"{target}\",\"row\":{water.Row},\"col\":{water.Col}," +
            "\"result\":\"miss\",\"sunk\":false,\"sunkCells\":null,\"allSunk\":false,\"auto\":false}",
            ProtocolJson.Serialize(outbounds[0].Message));
        var turn = Assert.IsType<Turn>(outbounds[1].Message);
        Assert.Equal(target, turn.ActivePlayerId);
        Assert.Equal(2, turn.TurnNumber);
        Assert.Equal((match.Id, 2), setup.Timer.Started.Last());
    }

    [Fact]
    public void AfterAHit_TheOtherPlayerIsActive()
    {
        var setup = new EngineSetup();
        var match = setup.StartPlaying();
        string by = match.ActivePlayerId!;
        string target = Other(match);
        var shipCell = Cells(target == "p1" ? FleetA : FleetB).First();

        var outbounds = setup.Engine.Fire(by, shipCell.Row, shipCell.Col);

        Assert.Equal(FireResult.Hit, Assert.IsType<FireResult>(outbounds[0].Message).Result);
        Assert.Equal(target, match.ActivePlayerId);
        Assert.Equal(target, Assert.IsType<Turn>(outbounds[1].Message).ActivePlayerId);
    }

    [Fact]
    public void SinkingAShip_SendsSunkWithItsFourCells()
    {
        var setup = new EngineSetup();
        var match = setup.StartPlaying();
        string shooter = match.ActivePlayerId!;
        string target = Other(match);
        var ship = (target == "p1" ? FleetA : FleetB)[1];
        var water = Water(shooter == "p1" ? FleetA : FleetB).GetEnumerator();

        IReadOnlyList<Host.Outbound> last = Array.Empty<Host.Outbound>();
        foreach (var cell in ship)
        {
            last = setup.Engine.Fire(shooter, cell.Row, cell.Col);
            if (cell != ship[^1])
            {
                water.MoveNext();
                setup.Engine.Fire(target, water.Current.Row, water.Current.Col);
            }
        }

        string cells = string.Join(",", ship.Select(c => $"[{c.Row},{c.Col}]"));
        Assert.Equal(
            $"{{\"type\":\"fireResult\",\"by\":\"{shooter}\",\"target\":\"{target}\",\"row\":{ship[^1].Row},\"col\":{ship[^1].Col}," +
            $"\"result\":\"hit\",\"sunk\":true,\"sunkCells\":[{cells}],\"allSunk\":false,\"auto\":false}}",
            ProtocolJson.Serialize(last[0].Message));
        Assert.IsType<Turn>(last[1].Message);
    }

    [Fact]
    public void SinkingTheLastShip_SendsAllSunk_AndNoTurn()
    {
        var setup = new EngineSetup();
        setup.StartPlaying();

        var last = setup.PlayToWin("p2");

        var shot = Assert.IsType<FireResult>(last[0].Message);
        Assert.True(shot.Sunk);
        Assert.True(shot.AllSunk);
        Assert.Equal(4, shot.SunkCells!.Count);
        Assert.Empty(Messages<Turn>(last));
    }
}

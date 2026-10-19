using Battleship.Core;
using Battleship.Core.Protocol;
using Battleship.Server.Engine;
using Battleship.Server.Host;
using static Battleship.Server.Tests.EngineSetup;

namespace Battleship.Server.Tests;

public class StreakTests
{
    [Fact]
    public void HitsInARow_SendStreakUpdateToBoth_FromTheSecond_RightAfterTheShot()
    {
        var setup = new EngineSetup();
        var match = setup.StartPlaying();
        var (shooter, other) = Sides(match);
        var targets = ShipCells(other);
        var water = WaterCells(shooter);

        var first = FireAt(setup, shooter, targets);
        Assert.Empty(Messages<StreakUpdate>(first));
        Assert.Equal(1, match.StreakOf(shooter));

        FireAt(setup, other, water);
        var second = FireAt(setup, shooter, targets);

        Assert.IsType<FireResult>(second[0].Message);
        Assert.Equal(new[] { "p1", "p2" }, second[1].To);
        Assert.Equal(
            $"{{\"type\":\"streakUpdate\",\"player\":\"{shooter}\",\"count\":2}}",
            ProtocolJson.Serialize(second[1].Message));
        Assert.IsType<Turn>(second[2].Message);
    }

    [Fact]
    public void Streak_KeepsCountingPastFour()
    {
        var setup = new EngineSetup();
        var match = setup.StartPlaying();
        var (shooter, other) = Sides(match);
        var targets = ShipCells(other);
        var water = WaterCells(shooter);

        var counts = new List<int>();
        for (int shot = 0; shot < 6; shot++)
        {
            counts.AddRange(Messages<StreakUpdate>(FireAt(setup, shooter, targets)).Select(update => update.Count));
            FireAt(setup, other, water);
        }

        Assert.Equal(new[] { 2, 3, 4, 5, 6 }, counts);
    }

    [Fact]
    public void OpponentShotsInBetween_DontBreakIt_AndEachPlayerHasTheirOwn()
    {
        var setup = new EngineSetup();
        var match = setup.StartPlaying();
        var (shooter, other) = Sides(match);
        var shooterTargets = ShipCells(other);
        var otherTargets = ShipCells(shooter);
        var otherWater = WaterCells(shooter);

        FireAt(setup, shooter, shooterTargets);
        FireAt(setup, other, otherTargets); // the opponent hits
        FireAt(setup, shooter, shooterTargets);
        FireAt(setup, other, otherWater); // the opponent misses
        var third = FireAt(setup, shooter, shooterTargets);

        var update = Messages<StreakUpdate>(third).Single();
        Assert.Equal(shooter, update.Player);
        Assert.Equal(3, update.Count);
        Assert.Equal(0, match.StreakOf(other));
    }

    [Fact]
    public void AMiss_ResetsTheStreakToZero()
    {
        var setup = new EngineSetup();
        var match = setup.StartPlaying();
        var (shooter, other) = Sides(match);
        var targets = ShipCells(other);
        var shooterWater = WaterCells(other);
        var otherWater = WaterCells(shooter);

        FireAt(setup, shooter, targets);
        FireAt(setup, other, otherWater);
        FireAt(setup, shooter, targets);
        FireAt(setup, other, otherWater);
        var miss = FireAt(setup, shooter, shooterWater);

        Assert.Equal(0, match.StreakOf(shooter));
        Assert.Empty(Messages<StreakUpdate>(miss));

        FireAt(setup, other, otherWater);
        Assert.Empty(Messages<StreakUpdate>(FireAt(setup, shooter, targets)));
        FireAt(setup, other, otherWater);
        Assert.Equal(2, Messages<StreakUpdate>(FireAt(setup, shooter, targets)).Single().Count);
    }

    [Fact]
    public void ATimeout_ResetsTheStreakToZero_EvenWhenTheAutoShotHits()
    {
        bool sawAutoHit = false;
        bool sawAutoMiss = false;

        // The auto-fire cell is random, so try seeds until both outcomes are covered.
        for (int seed = 1; seed <= 40 && !(sawAutoHit && sawAutoMiss); seed++)
        {
            var setup = new EngineSetup(seed);
            var match = setup.StartPlaying();
            var (shooter, other) = Sides(match);
            var targets = ShipCells(other);
            var otherWater = WaterCells(shooter);

            FireAt(setup, shooter, targets);
            FireAt(setup, other, otherWater);
            FireAt(setup, shooter, targets);
            FireAt(setup, other, otherWater);
            Assert.Equal(2, match.StreakOf(shooter));

            var expired = setup.Engine.TurnExpired(match.Id, match.TurnNumber);

            var shot = Messages<FireResult>(expired).Single();
            Assert.True(shot.Auto);
            Assert.Empty(Messages<StreakUpdate>(expired));
            Assert.Equal(0, match.StreakOf(shooter));
            if (shot.Result == FireResult.Hit) sawAutoHit = true;
            else sawAutoMiss = true;
        }

        Assert.True(sawAutoHit, "No seed gave an auto-fire hit.");
        Assert.True(sawAutoMiss, "No seed gave an auto-fire miss.");
    }

    [Fact]
    public void TheWinningShot_SendsStreakUpdateBeforeMatchEnd()
    {
        var setup = new EngineSetup();
        setup.StartPlaying();

        var last = setup.PlayToWin("p1");

        Assert.Collection(last,
            outbound => Assert.IsType<FireResult>(outbound.Message),
            outbound => Assert.Equal(16, Assert.IsType<StreakUpdate>(outbound.Message).Count),
            outbound => Assert.IsType<MatchEnd>(outbound.Message));
    }

    [Fact]
    public void ARematch_StartsBothStreaksAtZero()
    {
        var setup = new EngineSetup();
        setup.StartPlaying();
        setup.PlayToWin("p1");
        setup.Engine.Rematch("p1");
        setup.Engine.Rematch("p2");
        var rematch = setup.Engine.Matches.Single();
        setup.Engine.Place("p1", FleetA);
        setup.Engine.Place("p2", FleetB);

        Assert.Equal(0, rematch.StreakOf("p1"));
        Assert.Equal(0, rematch.StreakOf("p2"));
        // The winner goes first; one hit is not a streak yet.
        Assert.Empty(Messages<StreakUpdate>(FireAt(setup, "p1", ShipCells("p2"))));
    }

    [Fact]
    public void AnAdminReset_StartsTheNextMatchAtZero()
    {
        var setup = new EngineSetup();
        var match = setup.StartPlaying();
        var (shooter, other) = Sides(match);
        var targets = ShipCells(other);
        FireAt(setup, shooter, targets);
        FireAt(setup, other, WaterCells(shooter));
        FireAt(setup, shooter, targets);
        Assert.Equal(2, match.StreakOf(shooter));

        setup.Engine.Reset();
        setup.Engine.FindMatch("p1");
        setup.Engine.FindMatch("p2");
        var next = setup.Engine.Matches.Single();
        setup.Engine.Place("p1", FleetA);
        setup.Engine.Place("p2", FleetB);

        Assert.NotSame(match, next);
        Assert.Equal(0, next.StreakOf("p1"));
        Assert.Equal(0, next.StreakOf("p2"));
        string first = next.ActivePlayerId!;
        Assert.Empty(Messages<StreakUpdate>(FireAt(setup, first, ShipCells(first == "p1" ? "p2" : "p1"))));
    }

    private static (string Shooter, string Other) Sides(Match match)
    {
        string shooter = match.ActivePlayerId!;
        return (shooter, match.Players.Single(p => p.Id != shooter).Id);
    }

    // The ship cells of this player's fleet: every one is a hit for the opponent.
    private static Queue<Coord> ShipCells(string playerId) => new(Cells(playerId == "p1" ? FleetA : FleetB));

    // The water of this player's fleet: every one is a miss for the opponent.
    private static Queue<Coord> WaterCells(string playerId) => new(Water(playerId == "p1" ? FleetA : FleetB));

    private static IReadOnlyList<Outbound> FireAt(EngineSetup setup, string playerId, Queue<Coord> cells)
    {
        var cell = cells.Dequeue();
        return setup.Engine.Fire(playerId, cell.Row, cell.Col);
    }
}

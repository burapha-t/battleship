using Battleship.Core;
using Battleship.Core.Protocol;
using static Battleship.Server.Tests.EngineSetup;

namespace Battleship.Server.Tests;

public class TurnTimeoutTests
{
    [Fact]
    public void FireThenExpiryForThatTurn_GivesExactlyOneShot()
    {
        var setup = new EngineSetup();
        var match = setup.StartPlaying();
        setup.Engine.Fire(match.ActivePlayerId!, 0, 7);

        // The timer for turn 1 fires at 9.9 s, just after the shot.
        Assert.Empty(setup.Engine.TurnExpired(match.Id, 1));

        Assert.Single(match.Moves);
        Assert.Equal(2, match.TurnNumber);
    }

    [Fact]
    public void ExpiryForTheCurrentTurn_AutoFiresForTheActivePlayer_ThenNextTurn()
    {
        var setup = new EngineSetup();
        var match = setup.StartPlaying();
        string active = match.ActivePlayerId!;

        var outbounds = setup.Engine.TurnExpired(match.Id, 1);

        var shot = Assert.IsType<FireResult>(outbounds[0].Message);
        Assert.Equal(new[] { "p1", "p2" }, outbounds[0].To);
        Assert.True(shot.Auto);
        Assert.Equal(active, shot.By);
        var turn = Assert.IsType<Turn>(outbounds[1].Message);
        Assert.Equal(2, turn.TurnNumber);
        Assert.NotEqual(active, turn.ActivePlayerId);
        Assert.Equal((match.Id, 2), setup.Timer.Started.Last());
        Assert.True(Assert.Single(match.Moves).Auto);
    }

    [Fact]
    public void AutoFire_OnlyPicksCellsNotShotYet()
    {
        var setup = new EngineSetup(seed: 5);
        var match = setup.StartPlaying();
        var shotAt = new Dictionary<string, HashSet<Coord>> { ["p1"] = new(), ["p2"] = new() };

        // Turns 1-6 are real shots at row 0, so the auto-fires must avoid those.
        for (int col = 0; col < 6; col++)
        {
            string active = match.ActivePlayerId!;
            setup.Engine.Fire(active, 0, col);
            shotAt[active].Add(new Coord(0, col));
        }
        while (match.Phase == Engine.MatchPhase.Playing)
        {
            var shot = Messages<FireResult>(setup.Engine.TurnExpired(match.Id, match.TurnNumber)).Single();
            Assert.True(shot.Auto);
            Assert.True(shotAt[shot.By].Add(new Coord(shot.Row, shot.Col)), $"{shot.By} auto-fired at [{shot.Row},{shot.Col}] twice.");
        }
    }

    [Fact]
    public void SameSeed_AutoFiresAtTheSameCell()
    {
        var first = new EngineSetup(seed: 3);
        var second = new EngineSetup(seed: 3);
        var a = first.StartPlaying();
        var b = second.StartPlaying();

        var shotA = Messages<FireResult>(first.Engine.TurnExpired(a.Id, 1)).Single();
        var shotB = Messages<FireResult>(second.Engine.TurnExpired(b.Id, 1)).Single();

        Assert.Equal((shotA.Row, shotA.Col), (shotB.Row, shotB.Col));
    }

    [Fact]
    public void ExpiryForAnOldTurn_IsDropped()
    {
        var setup = new EngineSetup();
        var match = setup.StartPlaying();
        setup.Engine.Fire(match.ActivePlayerId!, 0, 7);
        setup.Engine.Fire(match.ActivePlayerId!, 0, 7);

        Assert.Empty(setup.Engine.TurnExpired(match.Id, 2));
        Assert.Equal(3, match.TurnNumber);
    }

    [Fact]
    public void ExpiryForAnUnknownMatch_IsDropped()
    {
        var setup = new EngineSetup();
        setup.StartPlaying();

        Assert.Empty(setup.Engine.TurnExpired("m99", 1));
    }

    [Fact]
    public void ExpiryWhilePlacing_IsDropped()
    {
        var setup = new EngineSetup();
        var match = setup.Pair();

        Assert.Empty(setup.Engine.TurnExpired(match.Id, 0));
    }

    [Fact]
    public void EveryTurn_StartsTheTimerForThatTurnNumber()
    {
        var setup = new EngineSetup();
        var match = setup.StartPlaying();
        setup.Engine.Fire(match.ActivePlayerId!, 0, 7);
        setup.Engine.TurnExpired(match.Id, 2);

        Assert.Equal(new[] { (match.Id, 1), (match.Id, 2), (match.Id, 3) }, setup.Timer.Started);
    }
}

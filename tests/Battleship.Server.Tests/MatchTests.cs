using Battleship.Core.Protocol;
using Battleship.Server.Engine;
using Battleship.Server.Lobby;

namespace Battleship.Server.Tests;

public class MatchTests
{
    private static PlayerRecord Player(string id, string name, int score = 0) =>
        new(id, "127.0.0.1", DateTimeOffset.Now) { Name = name, Status = LobbyStatus.Idle, Score = score };

    [Fact]
    public void FixedSeeds_EitherPlayerCanGoFirst()
    {
        var firsts = new HashSet<string>();
        for (int seed = 0; seed < 20; seed++)
            firsts.Add(new Match("m1", Player("p1", "Alice"), Player("p2", "Bob"), new Random(seed)).FirstPlayerId);

        Assert.Equal(new HashSet<string> { "p1", "p2" }, firsts);
    }

    [Fact]
    public void SameSeed_PicksTheSameFirstPlayer()
    {
        for (int seed = 0; seed < 20; seed++)
        {
            var first = new Match("m1", Player("p1", "Alice"), Player("p2", "Bob"), new Random(seed));
            var again = new Match("m1", Player("p1", "Alice"), Player("p2", "Bob"), new Random(seed));

            Assert.Equal(first.FirstPlayerId, again.FirstPlayerId);
            Assert.True(first.FirstPickedAtRandom);
        }
    }

    [Fact]
    public void GivenFirstPlayer_IsUsed_NotRandom()
    {
        var match = new Match("m2", Player("p1", "Alice"), Player("p2", "Bob"), new Random(0), firstPlayerId: "p2");

        Assert.Equal("p2", match.FirstPlayerId);
        Assert.False(match.FirstPickedAtRandom);
    }

    [Fact]
    public void Start_SendsMatchStartToBoth_WithBothPlayersAndCurrentScores()
    {
        var match = new Match("m7", Player("p1", "Alice", score: 2), Player("p2", "Bob", score: 1), new Random(0));

        var outbound = Assert.Single(match.Start());

        Assert.Equal(new[] { "p1", "p2" }, outbound.To);
        var start = Assert.IsType<MatchStart>(outbound.Message);
        Assert.Equal("m7", start.MatchId);
        Assert.Equal(match.FirstPlayerId, start.FirstPlayerId);
        Assert.Collection(start.Players,
            p => { Assert.Equal("p1", p.Id); Assert.Equal("Alice", p.Name); Assert.Equal(2, p.Score); },
            p => { Assert.Equal("p2", p.Id); Assert.Equal("Bob", p.Name); Assert.Equal(1, p.Score); });
    }

    [Fact]
    public void Start_PutsBothPlayersInPlacing()
    {
        var alice = Player("p1", "Alice");
        var bob = Player("p2", "Bob");
        var match = new Match("m1", alice, bob, new Random(0));

        match.Start();

        Assert.Equal(MatchPhase.Placing, match.Phase);
        Assert.Equal(LobbyStatus.Placing, alice.Status);
        Assert.Equal(LobbyStatus.Placing, bob.Status);
        Assert.Equal(0, match.TurnNumber);
    }

    [Fact]
    public void EveryShot_IsInTheMoveLog()
    {
        var setup = new EngineSetup();
        var match = setup.StartPlaying();
        string first = match.ActivePlayerId!;

        setup.Engine.Fire(first, 0, 0);
        string second = match.ActivePlayerId!;
        setup.Engine.Fire(second, 7, 7);

        Assert.Collection(match.Moves,
            shot => { Assert.Equal(first, shot.By); Assert.Equal(1, shot.TurnNumber); Assert.False(shot.Auto); },
            shot => { Assert.Equal(second, shot.By); Assert.Equal(2, shot.TurnNumber); });
    }
}

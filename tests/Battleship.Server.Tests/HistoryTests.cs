using Battleship.Core;
using Battleship.Core.Protocol;
using Battleship.Server.Data;

namespace Battleship.Server.Tests;

// HIST-1: GameDatabase.GetHistory, the data behind the history reply.
public class HistoryTests : IDisposable
{
    private static readonly DateTimeOffset Start = new(2026, 10, 19, 7, 0, 0, TimeSpan.Zero);

    private readonly string _folder = Path.Combine(Path.GetTempPath(), "battleship-history-" + Guid.NewGuid().ToString("N"));
    private readonly GameDatabase _database;
    private readonly long _alice, _bob, _carol, _dan;

    public HistoryTests()
    {
        _database = new GameDatabase(Path.Combine(_folder, "test.db"));
        _alice = User("Alice");
        _bob = User("Bob");
        _carol = User("Carol");
        _dan = User("Dan");
    }

    public void Dispose()
    {
        GameDatabase.ClearPool(_database.Path);
        if (Directory.Exists(_folder)) Directory.Delete(_folder, recursive: true);
    }

    [Fact]
    public void ANewPlayer_GetsZerosAndNoMatches()
    {
        var history = _database.GetHistory(_alice, 1);

        Assert.Equal(1, history.Page);
        Assert.Equal((0, 0, 0, 0.0, 0.0), Stats(history));
        Assert.Empty(history.Matches);
        Assert.False(history.More);
    }

    [Fact]
    public void StatsAndList_MatchTheSavedMatches_NewestFirst()
    {
        // Alice: won 4/6, lost 1/5, won 3/4 → 2 of 3 won, 8 hits of 15 shots.
        Save(_alice, _bob, winner: _alice, minutes: 0, aliceHits: 4, aliceShots: 6);
        Save(_alice, _bob, winner: _bob, minutes: 10, aliceHits: 1, aliceShots: 5);
        Save(_alice, _carol, winner: _alice, minutes: 20, aliceHits: 3, aliceShots: 4);

        var history = _database.GetHistory(_alice, 1);

        Assert.Equal((3, 2, 1, 66.7, 53.3), Stats(history));
        Assert.Collection(history.Matches,
            m => Assert.Equal((true, "Carol", "2026-10-19T07:20:00Z", 75.0), Row(m)),
            m => Assert.Equal((false, "Bob", "2026-10-19T07:10:00Z", 20.0), Row(m)),
            m => Assert.Equal((true, "Bob", "2026-10-19T07:00:00Z", 66.7), Row(m)));
        Assert.False(history.More);
    }

    [Fact]
    public void Page2_GivesTheNext20()
    {
        for (int i = 0; i < 45; i++) Save(_alice, _bob, winner: _alice, minutes: i, aliceHits: 1, aliceShots: 2);

        var pages = new[] { 1, 2, 3 }.Select(page => _database.GetHistory(_alice, page)).ToList();

        Assert.Equal(new[] { 20, 20, 5 }, pages.Select(p => p.Matches.Count));
        Assert.Equal(new[] { true, true, false }, pages.Select(p => p.More));
        Assert.Equal(new[] { 1, 2, 3 }, pages.Select(p => p.Page));
        var times = pages.SelectMany(p => p.Matches).Select(m => m.EndedAt).ToList();
        Assert.Equal(45, times.Distinct().Count());
        Assert.Equal(times.OrderByDescending(t => t, StringComparer.Ordinal), times);
        Assert.All(pages, p => Assert.Equal(45, p.Stats.MatchCount));
    }

    [Fact]
    public void APageBelowOne_IsPageOne_AndAPagePastTheEnd_IsEmpty()
    {
        Save(_alice, _bob, winner: _alice, minutes: 0, aliceHits: 1, aliceShots: 1);

        Assert.Equal(1, _database.GetHistory(_alice, 0).Page);
        Assert.Single(_database.GetHistory(_alice, -5).Matches);
        Assert.Empty(_database.GetHistory(_alice, 9).Matches);
        Assert.Equal(1, _database.GetHistory(_alice, 9).Stats.MatchCount);
    }

    [Fact]
    public void APlayer_NeverGetsSomeoneElsesHistory()
    {
        Save(_alice, _bob, winner: _alice, minutes: 0, aliceHits: 2, aliceShots: 4);
        Save(_carol, _dan, winner: _dan, minutes: 5, aliceHits: 0, aliceShots: 0);

        var carol = _database.GetHistory(_carol, 1);
        var bob = _database.GetHistory(_bob, 1);

        Assert.Equal("Dan", Assert.Single(carol.Matches).Opponent);
        Assert.Equal((1, 0, 1, 0.0), (carol.Stats.MatchCount, carol.Stats.WinCount, carol.Stats.LoseCount, carol.Stats.WinRate));
        var match = Assert.Single(bob.Matches);
        Assert.Equal(("Alice", false), (match.Opponent, match.Won));
    }

    // ---- Helpers ----

    private long User(string name) => _database.CreateUser(name, new byte[16], new byte[32], 1)!.Value;

    /// <summary>
    /// Saves one match ending <paramref name="minutes"/> after <see cref="Start"/>.
    /// The first player fires <paramref name="aliceShots"/> shots, the first
    /// <paramref name="aliceHits"/> of them hits; the second fires 3 misses.
    /// </summary>
    private void Save(long first, long second, long winner, int minutes, int aliceHits, int aliceShots)
    {
        var shots = new List<ShotRecord>();
        int turn = 1;
        for (int i = 0; i < aliceShots; i++) shots.Add(new ShotRecord(turn++, first, new Coord(i / 8, i % 8), i < aliceHits, false));
        for (int i = 0; i < 3; i++) shots.Add(new ShotRecord(turn++, second, new Coord(7, i), false, false));
        var ended = Start.AddMinutes(minutes);
        _database.SaveMatch(new MatchRecord(ended.AddMinutes(-3), ended, winner,
            new[] { new MatchPlayerRecord(first, Fleet(0)), new MatchPlayerRecord(second, Fleet(4)) }, shots));
    }

    private static IReadOnlyList<IReadOnlyList<Coord>> Fleet(int firstRow) =>
        Enumerable.Range(0, GameRules.ShipCount)
            .Select(i => (IReadOnlyList<Coord>)Enumerable.Range(0, GameRules.ShipLength).Select(c => new Coord(firstRow + i, c)).ToList())
            .ToList();

    private static (int, int, int, double, double) Stats(History h) =>
        (h.Stats.MatchCount, h.Stats.WinCount, h.Stats.LoseCount, h.Stats.WinRate, h.Stats.Accuracy);

    private static (bool, string, string, double) Row(HistoryMatch m) => (m.Won, m.Opponent, m.EndedAt, m.Accuracy);
}

using Battleship.Core;
using Battleship.Core.Protocol;
using Battleship.Server.Data;
using Microsoft.Data.Sqlite;
using static Battleship.Server.Tests.EngineSetup;

namespace Battleship.Server.Tests;

// ACH-1 (#41): badges earned from saved matches, and the worker telling each player.
public class AchievementTests : IDisposable
{
    private static readonly DateTimeOffset Start = new(2026, 10, 19, 7, 0, 0, TimeSpan.Zero);

    private readonly string _folder = Path.Combine(Path.GetTempPath(), "battleship-badges-" + Guid.NewGuid().ToString("N"));
    private readonly GameDatabase _database;
    private readonly long _alice, _bob;
    private int _minutes;

    public AchievementTests()
    {
        _database = new GameDatabase(Path.Combine(_folder, "test.db"));
        _alice = _database.CreateUser("Alice", new byte[16], new byte[32], 1)!.Value;
        _bob = _database.CreateUser("Bob", new byte[16], new byte[32], 1)!.Value;
    }

    public void Dispose()
    {
        GameDatabase.ClearPool(_database.Path);
        if (Directory.Exists(_folder)) Directory.Delete(_folder, recursive: true);
    }

    [Fact]
    public void ANewPlayer_GetsZerosAndNoBadges()
    {
        var list = _database.GetAchievements(_alice);

        Assert.Equal((0, 0.0, 0), (list.Wins, list.BestAccuracy, list.BestStreak));
        Assert.Empty(list.Badges);
    }

    [Fact]
    public void EachWinTier_IsEarnedOnce_InTheMatchThatReachesIt()
    {
        var earnedAt = new Dictionary<string, int>();
        for (int win = 1; win <= 101; win++)
        {
            foreach (var badge in Group("wins", Unlock(_alice, Save(Shots(hits: 1, misses: 3), aliceWins: true))))
                earnedAt.Add(badge.Code, win); // Add throws if a badge comes twice.
        }

        Assert.Equal(new Dictionary<string, int>
        {
            ["wins-5"] = 5, ["wins-10"] = 10, ["wins-20"] = 20, ["wins-50"] = 50, ["wins-100"] = 100,
        }, earnedAt);
    }

    [Fact]
    public void EachAccuracyTier_IsEarnedOnce_OnlyWhenStrictlyOver()
    {
        // Hits out of 10 shots in each match: exactly 40% earns nothing; a repeat earns nothing new.
        int[] hits = { 4, 5, 3, 6, 7, 7, 8, 8, 9, 9 };
        var codes = hits
            .Select(h => Group("accuracy", Unlock(_alice, Save(Shots(hits: h, misses: 10 - h), aliceWins: false))))
            .Select(badges => badges.Select(b => b.Code).ToArray())
            .ToList();

        Assert.Equal(new[]
        {
            Array.Empty<string>(),                                // 40%
            new[] { "accuracy-40" },                              // 50%
            Array.Empty<string>(),                                // 30%
            new[] { "accuracy-50" },                              // 60%
            new[] { "accuracy-60" },                              // 70%
            Array.Empty<string>(),                                // 70% again
            new[] { "accuracy-70" },                              // 80%
            Array.Empty<string>(),                                // 80% again
            new[] { "accuracy-80" },                              // 90%
            Array.Empty<string>(),                                // 90% again
        }, codes);
    }

    [Fact]
    public void EachStreakTier_IsEarnedOnce_FromOneMatchsBestRun()
    {
        var earnedAt = new Dictionary<string, int>();
        foreach (int streak in new[] { 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 4 })
        {
            foreach (var badge in Group("streak", Unlock(_alice, Save(Shots(hits: streak, misses: 1), aliceWins: false))))
                earnedAt.Add(badge.Code, streak);
        }

        Assert.Equal(new Dictionary<string, int>
        {
            ["streak-4"] = 4, ["streak-6"] = 6, ["streak-8"] = 8, ["streak-10"] = 10, ["streak-12"] = 12,
        }, earnedAt);
    }

    [Fact]
    public void OneMatch_CanEarnSeveralBadges_AllAtTheMatchEnd()
    {
        // 16 hits from 16 shots: 100% accuracy and a run of 16.
        long match = Save(Shots(hits: 16, misses: 0), aliceWins: true);
        var badges = _database.UnlockAchievements(_alice, match, Start);

        Assert.Equal(new[]
        {
            "accuracy-40", "accuracy-50", "accuracy-60", "accuracy-70", "accuracy-80",
            "streak-4", "streak-6", "streak-8", "streak-10", "streak-12",
        }, badges.Select(b => b.Code));
        Assert.All(badges, b => Assert.Equal("2026-10-19T07:00:00Z", b.UnlockedAt));
    }

    [Fact]
    public void ALoser_EarnsAccuracyAndStreak_ButNoWins()
    {
        long match = Save(Shots(hits: 4, misses: 1), aliceWins: false);

        Assert.Equal(new[] { "accuracy-40", "accuracy-50", "accuracy-60", "accuracy-70", "streak-4" },
            Unlock(_alice, match).Select(b => b.Code));
    }

    [Fact]
    public void Unlocking_TouchesOnlyThatPlayer_AndOnlyMatchesTheyPlayed()
    {
        long match = Save(Shots(hits: 4, misses: 1), aliceWins: true);
        long carol = _database.CreateUser("Carol", new byte[16], new byte[32], 1)!.Value;

        Unlock(_alice, match);

        Assert.Empty(_database.GetAchievements(_bob).Badges);
        Assert.Empty(Unlock(carol, match));
    }

    [Fact]
    public void List_HasBestStats_AndBadgesOldestFirst()
    {
        Unlock(_alice, Save(Shots(hits: 2, misses: 2), aliceWins: true));   // 50%, run of 2
        Unlock(_alice, Save(Shots(hits: 5, misses: 1), aliceWins: false));  // 83.3%, run of 5
        Unlock(_alice, Save(Shots(hits: 1, misses: 2), aliceWins: true));   // 33.3%

        var list = _database.GetAchievements(_alice);

        Assert.Equal((2, 83.3, 5), (list.Wins, list.BestAccuracy, list.BestStreak));
        Assert.Equal(new[]
        {
            ("accuracy-40", "2026-10-19T07:01:00Z"),
            ("accuracy-50", "2026-10-19T07:02:00Z"),
            ("accuracy-60", "2026-10-19T07:02:00Z"),
            ("accuracy-70", "2026-10-19T07:02:00Z"),
            ("accuracy-80", "2026-10-19T07:02:00Z"),
            ("streak-4", "2026-10-19T07:02:00Z"),
        }, list.Badges.Select(b => (b.Code, b.UnlockedAt)));
    }

    // ---- Through the engine and DatabaseWorker ----

    [Theory]
    [InlineData(true, false)]
    [InlineData(false, true)]
    [InlineData(false, false)]
    public async Task AGuestInTheMatch_EarnsNothing_AndNeitherDoesTheirOpponent(bool aliceLoggedIn, bool bobLoggedIn)
    {
        var replies = new List<(string PlayerId, ProtocolMessage Message)>();
        var worker = new DatabaseWorker(_database, (id, message) => replies.Add((id, message)));
        var setup = new EngineSetup(archive: worker);
        setup.Join("p1", "Alice").UserId = aliceLoggedIn ? _alice : null;
        setup.Join("p2", "Bob").UserId = bobLoggedIn ? _bob : null;
        setup.StartPlaying();

        setup.PlayToWin("p1"); // 16 hits in a row: every accuracy and streak badge, for an account
        await worker.CompleteAsync();

        Assert.Empty(replies);
        Assert.Empty(_database.GetAchievements(_alice).Badges);
        Assert.Empty(_database.GetAchievements(_bob).Badges);
    }

    [Fact]
    public async Task Worker_SendsEachPlayerTheirOwnNewBadges_WithTheWireMatchId()
    {
        var replies = new List<(string PlayerId, ProtocolMessage Message)>();
        var worker = new DatabaseWorker(_database, (id, message) => replies.Add((id, message)));
        var setup = new EngineSetup(archive: worker);
        setup.Join("p1", "Alice").UserId = _alice;
        setup.Join("p2", "Bob").UserId = _bob;
        var match = setup.StartPlaying();

        setup.PlayToWin("p1");
        await worker.CompleteAsync();

        var (playerId, message) = Assert.Single(replies);
        Assert.Equal("p1", playerId);
        var unlocked = Assert.IsType<AchievementUnlocked>(message);
        Assert.Equal(match.Id, unlocked.MatchId);
        Assert.Equal(Group("streak", unlocked.Badges).Select(b => b.Code), new[] { "streak-4", "streak-6", "streak-8", "streak-10", "streak-12" });
    }

    [Fact]
    public async Task Worker_SendsNothingWhenThereIsNothingNew()
    {
        var replies = new List<(string PlayerId, ProtocolMessage Message)>();
        var worker = new DatabaseWorker(_database, (id, message) => replies.Add((id, message)));
        var record = new MatchRecord(Start.AddMinutes(-3), Start, _alice,
            new[] { new MatchPlayerRecord(_alice, FleetA), new MatchPlayerRecord(_bob, FleetB) },
            new[] { new ShotRecord(1, _alice, new Coord(7, 7), false, false) });

        worker.Save(record, "m1", new[] { "p1", "p2" });
        await worker.CompleteAsync();

        Assert.Empty(replies);
    }

    [Fact]
    public async Task AnUnlockFailure_KeepsTheSavedMatch_AndTheWorkerCarriesOn()
    {
        using (var connection = new SqliteConnection($"Data Source={_database.Path};Pooling=False"))
        {
            connection.Open();
            using var drop = connection.CreateCommand();
            drop.CommandText = "DROP TABLE achievements;";
            drop.ExecuteNonQuery();
        }
        var worker = new DatabaseWorker(_database);
        var setup = new EngineSetup(archive: worker);
        setup.Join("p1", "Alice").UserId = _alice;
        setup.Join("p2", "Bob").UserId = _bob;
        setup.StartPlaying();
        setup.PlayToWin("p1");
        bool ranAfter = false;

        worker.Enqueue(_ => ranAfter = true);
        await worker.CompleteAsync();

        Assert.True(ranAfter);
        Assert.Single(_database.GetHistory(_alice, 1).Matches);
    }

    // ---- Helpers ----

    private IReadOnlyList<BadgeUnlock> Unlock(long userId, long matchId) =>
        _database.UnlockAchievements(userId, matchId, Start.AddMinutes(_minutes));

    private static IEnumerable<BadgeUnlock> Group(string group, IEnumerable<BadgeUnlock> badges) =>
        badges.Where(b => b.Code.StartsWith(group + "-", StringComparison.Ordinal));

    /// <summary>Alice's shots in turn order: <paramref name="hits"/> hits, then <paramref name="misses"/> misses.</summary>
    private static bool[] Shots(int hits, int misses) =>
        Enumerable.Repeat(true, hits).Concat(Enumerable.Repeat(false, misses)).ToArray();

    /// <summary>Saves one Alice vs Bob match, a minute after the last; Bob fires 3 misses.</summary>
    private long Save(bool[] aliceShots, bool aliceWins)
    {
        _minutes++;
        var shots = new List<ShotRecord>();
        int turn = 1;
        for (int i = 0; i < aliceShots.Length; i++) shots.Add(new ShotRecord(turn++, _alice, new Coord(i / 8, i % 8), aliceShots[i], false));
        for (int i = 0; i < 3; i++) shots.Add(new ShotRecord(turn++, _bob, new Coord(7, i), false, false));
        var ended = Start.AddMinutes(_minutes);
        return _database.SaveMatch(new MatchRecord(ended.AddMinutes(-3), ended, aliceWins ? _alice : _bob,
            new[] { new MatchPlayerRecord(_alice, FleetA), new MatchPlayerRecord(_bob, FleetB) }, shots));
    }
}

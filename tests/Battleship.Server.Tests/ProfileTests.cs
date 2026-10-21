using Battleship.Core;
using Battleship.Core.Protocol;
using Battleship.Server.Data;
using Microsoft.Data.Sqlite;
using static Battleship.Server.Tests.EngineSetup;

namespace Battleship.Server.Tests;

// #41/#42: real SQLite ownership, best stats, atomic edits and schema upgrade.
public class ProfileTests : IDisposable
{
    private readonly string _folder = Path.Combine(Path.GetTempPath(), "battleship-profile-" + Guid.NewGuid().ToString("N"));
    private readonly GameDatabase _db;
    private readonly long _alice, _bob;
    public ProfileTests()
    {
        _db = new GameDatabase(Path.Combine(_folder, "test.db"));
        _alice = _db.CreateUser("Alice", new byte[16], new byte[32], 1)!.Value;
        _bob = _db.CreateUser("Bob", new byte[16], new byte[32], 1)!.Value;
    }
    public void Dispose() { SqliteConnection.ClearAllPools(); Directory.Delete(_folder, true); }
    private long Save(int hits = 6, int shots = 8, bool aliceWins = true)
    {
        var time = DateTimeOffset.UtcNow;
        var moves = Enumerable.Range(0, shots).Select(i => new ShotRecord(i + 1, _alice, new Coord(i / 8, i % 8), i < hits, false)).ToList();
        return _db.SaveMatch(new MatchRecord(time.AddMinutes(-1), time, aliceWins ? _alice : _bob,
            new[] { new MatchPlayerRecord(_alice, FleetA), new MatchPlayerRecord(_bob, FleetB) }, moves));
    }
    [Fact]
    public void LoserUnlocksLowerTiersTogether_OnlyOnce_AndNeverForAnotherUser()
    {
        long id = Save(aliceWins: false);
        var unlocked = _db.UnlockAchievements(_alice, id, DateTimeOffset.UtcNow);
        Assert.Equal(new[] { "accuracy-40", "accuracy-50", "accuracy-60", "accuracy-70", "streak-4", "streak-6" }, unlocked.Select(b => b.Code));
        Assert.Empty(_db.UnlockAchievements(_alice, id, DateTimeOffset.UtcNow));
        Assert.Empty(_db.GetProfile(_bob).Badges);
        Assert.Empty(_db.UnlockAchievements(999, id, DateTimeOffset.UtcNow));
        Assert.Equal(unlocked.Select(b => b.Code), _db.GetProfile(_alice).Badges.Select(b => b.Code));
    }
    [Fact]
    public void ProfileHasDefaults_AndQueriesBestSingleMatchStats()
    {
        var empty = _db.GetProfile(_alice);
        Assert.Equal("", empty.Avatar); Assert.Empty(empty.ShownBadges); Assert.Empty(empty.Badges);
        Assert.Equal((0, 0.0, 0), (empty.Wins, empty.BestAccuracy, empty.BestStreak));
        Save(6, 8); Save(2, 3, false);
        var p = _db.GetProfile(_alice);
        Assert.Equal((1, 75.0, 6), (p.Wins, p.BestAccuracy, p.BestStreak));
        Assert.Equal(0, _db.GetProfile(_bob).BestAccuracy);
    }
    [Fact]
    public void ValidUpdate_PreservesDisplayOrder_AndCanClearChoices()
    {
        _db.UnlockAchievements(_alice, Save(), DateTimeOffset.UtcNow);
        var shown = new[] { "streak-6", "accuracy-70", "streak-4" };
        _db.SetProfile(_alice, "pufferfish", shown);
        Assert.Equal(shown, _db.GetProfile(_alice).ShownBadges);
        Assert.Equal("pufferfish", _db.GetProfile(_alice).Avatar);
        _db.SetProfile(_alice, "", Array.Empty<string>());
        Assert.Equal("", _db.GetProfile(_alice).Avatar); Assert.Empty(_db.GetProfile(_alice).ShownBadges);
    }
    public static IEnumerable<object?[]> InvalidUpdates() => new[] {
        new object?[] { "unknown", Array.Empty<string>() },
        new object?[] { "whale", new[] { "accuracy-40", "accuracy-50", "accuracy-60", "accuracy-70" } },
        new object?[] { "whale", new[] { "streak-4", "streak-4" } },
        new object?[] { "whale", new[] { "wins-5" } },
        new object?[] { "whale", new[] { "fake" } },
        new object?[] { null, Array.Empty<string>() }, new object?[] { "whale", null },
        new object?[] { "whale", new string[] { null! } },
    };
    [Theory]
    [MemberData(nameof(InvalidUpdates))]
    public void InvalidUpdate_ChangesNothing(string? avatar, string[]? shown)
    {
        _db.UnlockAchievements(_alice, Save(), DateTimeOffset.UtcNow);
        _db.SetProfile(_alice, "crab", new[] { "streak-4" });
        Assert.Throws<ArgumentException>(() => _db.SetProfile(_alice, avatar, shown));
        Assert.Equal("crab", _db.GetProfile(_alice).Avatar);
        Assert.Equal(new[] { "streak-4" }, _db.GetProfile(_alice).ShownBadges);
    }
    [Fact]
    public void Version1Upgrade_KeepsAccountsMatchesShotsFleetsAndBadges()
    {
        _db.UnlockAchievements(_alice, Save(), DateTimeOffset.UtcNow);
        using (var c = new SqliteConnection($"Data Source={_db.Path}"))
        {
            c.Open(); using var cmd = c.CreateCommand();
            cmd.CommandText = "ALTER TABLE users DROP COLUMN shown_badges; PRAGMA user_version=1;"; cmd.ExecuteNonQuery();
        }
        SqliteConnection.ClearAllPools(); // A v1 file is opened by a new server process.
        var upgraded = new GameDatabase(_db.Path);
        Assert.Equal(_alice, upgraded.FindUser("Alice")!.Id);
        Assert.Single(upgraded.GetHistory(_alice, 1).Matches);
        Assert.Equal(6, upgraded.GetProfile(_alice).Badges.Count);
        Assert.Empty(upgraded.GetProfile(_alice).ShownBadges);
        using var connection = new SqliteConnection($"Data Source={_db.Path}"); connection.Open();
        using var count = connection.CreateCommand(); count.CommandText = "SELECT (SELECT COUNT(*) FROM shots) + (SELECT COUNT(*) FROM fleets);";
        Assert.Equal(40L, count.ExecuteScalar());
    }
    [Fact]
    public void WinBadgesUseAllSavedWins_AndAccuracyRoundsToOneDecimal()
    {
        long last = 0;
        for (int i = 0; i < 10; i++) last = Save(2, 3);
        var badges = _db.UnlockAchievements(_alice, last, DateTimeOffset.UtcNow);
        Assert.Equal(new[] { "wins-5", "wins-10" }, badges.Where(b => b.Code.StartsWith("wins-")).Select(b => b.Code));
        Assert.Equal((10, 66.7), (_db.GetProfile(_alice).Wins, _db.GetProfile(_alice).BestAccuracy));
    }

    [Fact]
    public async Task WorkerRoutesBothPlayersNewBadges_WithTheWireMatchId()
    {
        var time = DateTimeOffset.UtcNow;
        var moves = new List<ShotRecord>();
        for (int i = 0; i < 6; i++)
        {
            moves.Add(new ShotRecord(i * 2 + 1, _alice, new Coord(0, i), true, false));
            moves.Add(new ShotRecord(i * 2 + 2, _bob, new Coord(1, i), i < 4, false));
        }
        var record = new MatchRecord(time.AddMinutes(-1), time, _alice,
            new[] { new MatchPlayerRecord(_alice, FleetA), new MatchPlayerRecord(_bob, FleetB) }, moves);
        var replies = new List<(string PlayerId, ProtocolMessage Message)>();
        var worker = new DatabaseWorker(_db, (id, message) => replies.Add((id, message)));
        worker.Save(record, "m-wire", new[] { "p-alice", "p-bob" });
        await worker.CompleteAsync();
        Assert.Equal(new[] { "p-alice", "p-bob" }, replies.Select(r => r.PlayerId));
        var winner = Assert.IsType<AchievementUnlocked>(replies[0].Message);
        var loser = Assert.IsType<AchievementUnlocked>(replies[1].Message);
        Assert.Equal("m-wire", loser.MatchId);
        Assert.Contains(winner.Badges, b => b.Code == "accuracy-80");
        Assert.DoesNotContain(loser.Badges, b => b.Code == "accuracy-70");
        Assert.Contains(loser.Badges, b => b.Code == "streak-4");
    }

    [Fact]
    public async Task UnlockFailure_DoesNotUndoMatch_AndWorkerContinues()
    {
        using (var c = new SqliteConnection($"Data Source={_db.Path}"))
        {
            c.Open(); using var cmd = c.CreateCommand(); cmd.CommandText = "DROP TABLE achievements;"; cmd.ExecuteNonQuery();
        }
        var setup = new EngineSetup(); setup.Join("p1", "Alice").UserId = _alice; setup.Join("p2", "Bob").UserId = _bob;
        setup.StartPlaying(); setup.PlayToWin("p1");
        var worker = new DatabaseWorker(_db); bool nextRan = false;
        worker.Save(setup.Engine.Matches.Single().ToRecord(DateTimeOffset.UtcNow)!, "m1", new[] { "p1", "p2" });
        worker.Enqueue(_ => nextRan = true); await worker.CompleteAsync();
        Assert.True(nextRan); Assert.Single(_db.GetHistory(_alice, 1).Matches);
    }
}

using Battleship.Core;
using Battleship.Server.Data;
using Microsoft.Data.Sqlite;
using static Battleship.Server.Tests.EngineSetup;

namespace Battleship.Server.Tests;

// #42: GameDatabase.GetProfile and SetProfile, and the schema version 2 upgrade.
public class ProfileTests : IDisposable
{
    private static readonly DateTimeOffset Start = new(2026, 10, 19, 7, 0, 0, TimeSpan.Zero);

    private readonly string _folder = Path.Combine(Path.GetTempPath(), "battleship-profile-" + Guid.NewGuid().ToString("N"));
    private readonly GameDatabase _database;
    private readonly long _alice, _bob;
    private readonly Dictionary<long, List<string>> _unlocked = new();
    private int _minutes;

    public ProfileTests()
    {
        _database = new GameDatabase(Path.Combine(_folder, "test.db"));
        _alice = User("Alice");
        _bob = User("Bob");
    }

    public void Dispose()
    {
        SqliteConnection.ClearAllPools();
        if (Directory.Exists(_folder)) Directory.Delete(_folder, recursive: true);
    }

    [Fact]
    public void ANewAccount_HasNoPictureNoBadgesNoRankAndNoWins()
    {
        var profile = _database.GetProfile(_alice);

        Assert.False(profile.Guest);
        Assert.Equal("", profile.Avatar);
        Assert.Empty(profile.ShownBadges);
        Assert.Null(profile.Rank);
        Assert.Equal(0, profile.Wins);
    }

    [Fact]
    public void SavedChoices_ReadBack_InTheChosenOrder()
    {
        EarnBadges();
        var shown = new[] { "streak-6", "accuracy-60", "streak-4" };

        _database.SetProfile(_alice, "pufferfish", shown);

        var profile = _database.GetProfile(_alice);
        Assert.Equal("pufferfish", profile.Avatar);
        Assert.Equal(shown, profile.ShownBadges);
    }

    [Fact]
    public void NoPictureAndNoBadges_CanBeSaved_AndClearEarlierChoices()
    {
        EarnBadges();
        _database.SetProfile(_alice, "crab", new[] { "streak-4" });

        _database.SetProfile(_alice, "", Array.Empty<string>());

        var profile = _database.GetProfile(_alice);
        Assert.Equal("", profile.Avatar);
        Assert.Empty(profile.ShownBadges);
    }

    [Fact]
    public void Badges_CanBeSaved_WithoutAPicture()
    {
        EarnBadges();

        _database.SetProfile(_alice, "", new[] { "accuracy-40" });

        Assert.Equal(new[] { "accuracy-40" }, _database.GetProfile(_alice).ShownBadges);
    }

    [Fact]
    public void EveryCataloguePicture_CanBeSaved()
    {
        foreach (var avatar in Avatars.Catalogue)
        {
            _database.SetProfile(_alice, avatar, Array.Empty<string>());
            Assert.Equal(avatar, _database.GetProfile(_alice).Avatar);
        }
    }

    [Fact]
    public void SavingOnePlayer_LeavesTheOtherAlone()
    {
        EarnBadges();

        _database.SetProfile(_alice, "shark", new[] { "streak-4" });

        var bob = _database.GetProfile(_bob);
        Assert.Equal("", bob.Avatar);
        Assert.Empty(bob.ShownBadges);
    }

    public static TheoryData<string?, string[]?> InvalidUpdates() => new()
    {
        { "dolphin", Array.Empty<string>() },                                         // not in the catalogue
        { "Whale", Array.Empty<string>() },                                           // case matters
        { null, Array.Empty<string>() },                                              // avatar missing
        { "whale", null },                                                            // shownBadges missing
        { "whale", new[] { "accuracy-40", "accuracy-50", "accuracy-60", "streak-4" } }, // more than 3
        { "whale", new[] { "streak-4", "streak-4" } },                                // a repeat
        { "whale", new[] { "fake-1" } },                                              // not a badge
        { "whale", new[] { "wins-5" } },                                              // not earned
    };

    [Theory]
    [MemberData(nameof(InvalidUpdates))]
    public void AnInvalidUpdate_IsRefused_AndChangesNothing(string? avatar, string[]? shown)
    {
        EarnBadges();
        _database.SetProfile(_alice, "crab", new[] { "streak-4" });

        Assert.Throws<ArgumentException>(() => _database.SetProfile(_alice, avatar, shown));

        var profile = _database.GetProfile(_alice);
        Assert.Equal("crab", profile.Avatar);
        Assert.Equal(new[] { "streak-4" }, profile.ShownBadges);
    }

    [Fact]
    public void ABadgeEarnedByAnotherPlayer_CannotBeShown()
    {
        EarnBadges(); // Alice's only

        Assert.Throws<ArgumentException>(() => _database.SetProfile(_bob, "", new[] { "streak-4" }));
    }

    [Fact]
    public void RankAndWins_MatchTheLeaderboard_TiesIncluded()
    {
        long carol = User("Carol");
        Save(_alice, winner: _alice, aliceHits: 2);
        Save(_alice, winner: _alice, aliceHits: 2);
        Save(carol, winner: carol, aliceHits: 2);
        Save(carol, winner: carol, aliceHits: 2);
        // Alice and Carol: 2 wins and the same accuracy, so both rank 1; Bob is 3rd.

        Assert.Equal((1, 2), (_database.GetProfile(_alice).Rank, _database.GetProfile(_alice).Wins));
        Assert.Equal((1, 2), (_database.GetProfile(carol).Rank, _database.GetProfile(carol).Wins));
        Assert.Equal((3, 0), (_database.GetProfile(_bob).Rank, _database.GetProfile(_bob).Wins));
        Assert.Equal(new[] { ("Alice", 1), ("Carol", 1), ("Bob", 3) }, _database.GetLeaderboard().Rows.Select(r => (r.Name, r.Rank)));
    }

    [Fact]
    public void Rank_CountsPlayersBelowTheTop50()
    {
        // 55 players each win once against Bob, so Bob, with 0 wins, is 56th.
        for (int i = 0; i < 55; i++) Save(User($"P{i:00}"), winner: null, aliceHits: 0);

        Assert.DoesNotContain(_database.GetLeaderboard().Rows, r => r.Name == "Bob");
        Assert.Equal(56, _database.GetProfile(_bob).Rank);
    }

    [Fact]
    public void AMissingAccount_Throws()
    {
        Assert.Throws<InvalidOperationException>(() => _database.GetProfile(999));
        Assert.Throws<InvalidOperationException>(() => _database.SetProfile(999, "whale", Array.Empty<string>()));
    }

    // ---- Schema version 2 ----

    [Fact]
    public void AVersion1File_IsUpgraded_AndKeepsItsAccountsAndMatches()
    {
        Save(_alice, winner: _alice, aliceHits: 4);
        string path = _database.Path;
        // Turn the file back into what a version 1 server made.
        Execute(path, "ALTER TABLE users DROP COLUMN shown_badges; PRAGMA user_version = 1;");
        Assert.DoesNotContain("shown_badges", Columns(path, "users"));
        SqliteConnection.ClearAllPools();

        var upgraded = new GameDatabase(path);

        Assert.Equal(GameDatabase.SchemaVersion, Scalar(path, "PRAGMA user_version"));
        Assert.Contains("shown_badges", Columns(path, "users"));
        Assert.Equal(_alice, upgraded.FindUser("Alice")!.Id);
        Assert.Equal(_bob, upgraded.FindUser("Bob")!.Id);
        Assert.Single(upgraded.GetHistory(_alice, 1).Matches);
        Assert.Equal(Unlocked(_alice), upgraded.GetAchievements(_alice).Badges.Select(b => b.Code));
        var profile = upgraded.GetProfile(_alice);
        Assert.Equal((1, 1), (profile.Rank, profile.Wins));
        Assert.Empty(profile.ShownBadges);
        upgraded.SetProfile(_alice, "turtle", new[] { "streak-4" });
        Assert.Equal(new[] { "streak-4" }, upgraded.GetProfile(_alice).ShownBadges);
    }

    // ---- Helpers ----

    private long User(string name) => _database.CreateUser(name, new byte[16], new byte[32], 1)!.Value;

    /// <summary>Alice loses one match with 7 hits in a row out of 10: accuracy 40–60 and streak 4–6.</summary>
    private void EarnBadges() => Save(_alice, winner: _bob, aliceHits: 7);

    /// <summary>
    /// Saves one match of <paramref name="player"/> against Bob (or Bob against
    /// Alice when <paramref name="player"/> is Bob) and unlocks its badges.
    /// The player fires 10 shots, the first <paramref name="aliceHits"/> hitting;
    /// Bob fires 3 misses. A null winner means <paramref name="player"/> wins.
    /// </summary>
    private void Save(long player, long? winner, int aliceHits)
    {
        long opponent = player == _bob ? _alice : _bob;
        var shots = new List<ShotRecord>();
        int turn = 1;
        for (int i = 0; i < 10; i++) shots.Add(new ShotRecord(turn++, player, new Coord(i / 8, i % 8), i < aliceHits, false));
        for (int i = 0; i < 3; i++) shots.Add(new ShotRecord(turn++, opponent, new Coord(7, i), false, false));
        var ended = Start.AddMinutes(++_minutes);
        long id = _database.SaveMatch(new MatchRecord(ended.AddMinutes(-3), ended, winner ?? player,
            new[] { new MatchPlayerRecord(player, FleetA), new MatchPlayerRecord(opponent, FleetB) }, shots));
        foreach (var user in new[] { player, opponent })
        {
            if (!_unlocked.TryGetValue(user, out var codes)) _unlocked[user] = codes = new List<string>();
            codes.AddRange(_database.UnlockAchievements(user, id, ended).Select(b => b.Code));
        }
    }

    private IEnumerable<string> Unlocked(long user) => _unlocked.TryGetValue(user, out var codes) ? codes : new List<string>();

    private static void Execute(string path, string sql)
    {
        using var connection = new SqliteConnection($"Data Source={path}");
        connection.Open();
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.ExecuteNonQuery();
    }

    private static long Scalar(string path, string sql)
    {
        using var connection = new SqliteConnection($"Data Source={path}");
        connection.Open();
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        return (long)command.ExecuteScalar()!;
    }

    private static List<string> Columns(string path, string table)
    {
        using var connection = new SqliteConnection($"Data Source={path}");
        connection.Open();
        using var command = connection.CreateCommand();
        command.CommandText = $"SELECT name FROM pragma_table_info('{table}')";
        using var reader = command.ExecuteReader();
        var names = new List<string>();
        while (reader.Read()) names.Add(reader.GetString(0));
        return names;
    }
}

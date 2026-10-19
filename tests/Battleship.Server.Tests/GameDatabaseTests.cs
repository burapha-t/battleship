using Battleship.Core;
using Battleship.Server.Data;
using Microsoft.Data.Sqlite;

namespace Battleship.Server.Tests;

public class GameDatabaseTests : IDisposable
{
    private static readonly byte[] Salt = Enumerable.Range(0, 16).Select(i => (byte)i).ToArray();
    private static readonly byte[] Hash = Enumerable.Range(100, 32).Select(i => (byte)i).ToArray();

    private readonly string _folder = Path.Combine(Path.GetTempPath(), "battleship-db-" + Guid.NewGuid().ToString("N"));
    private readonly string _path;

    public GameDatabaseTests() => _path = Path.Combine(_folder, "test.db");

    public void Dispose()
    {
        SqliteConnection.ClearAllPools();
        if (Directory.Exists(_folder)) Directory.Delete(_folder, recursive: true);
    }

    // ---- File and tables ----

    [Fact]
    public void NewPath_CreatesTheFolderTheFileAndEveryTable()
    {
        Assert.False(Directory.Exists(_folder));

        new GameDatabase(_path);

        Assert.True(File.Exists(_path));
        var tables = Column<string>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name");
        Assert.Equal(new[] { "achievements", "fleets", "match_players", "matches", "shots", "users" }, tables);
        Assert.Equal(GameDatabase.SchemaVersion, Scalar("PRAGMA user_version"));
    }

    [Fact]
    public void ReopeningTheFile_KeepsItsData()
    {
        var first = new GameDatabase(_path);
        long alice = first.CreateUser("Alice", Salt, Hash, 1000)!.Value;
        long bob = first.CreateUser("Bob", Salt, Hash, 1000)!.Value;
        first.SaveMatch(Match(alice, bob, winner: alice, Shots((1, alice, true))));
        SqliteConnection.ClearAllPools();

        var second = new GameDatabase(_path);

        Assert.Equal(alice, second.FindUser("Alice")!.Id);
        Assert.Equal(1, Scalar("SELECT COUNT(*) FROM matches"));
        Assert.Equal(2, Scalar("SELECT COUNT(*) FROM match_players"));
        Assert.Equal(1, Scalar("SELECT COUNT(*) FROM shots"));
        Assert.Equal(2 * CellsPerFleet, Scalar("SELECT COUNT(*) FROM fleets"));
    }

    [Fact]
    public void AFileFromANewerServer_IsRefusedAndLeftAlone()
    {
        new GameDatabase(_path);
        Execute($"PRAGMA user_version = {GameDatabase.SchemaVersion + 1}");

        Assert.Throws<InvalidOperationException>(() => new GameDatabase(_path));
        Assert.Equal(GameDatabase.SchemaVersion + 1, Scalar("PRAGMA user_version"));
    }

    [Fact]
    public void DefaultPath_IsInAppData_NotBesideTheServerProgram()
    {
        var path = GameDatabase.DefaultPath();

        Assert.EndsWith(Path.Combine("battleship", "battleship.db"), path);
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        if (!string.IsNullOrEmpty(appData)) Assert.StartsWith(appData, path);
    }

    // ---- Users ----

    [Fact]
    public void CreateUser_ThenFindUser_ReturnsEveryField()
    {
        var db = new GameDatabase(_path);
        var before = DateTimeOffset.UtcNow.AddSeconds(-1);

        long? id = db.CreateUser("Alice", Salt, Hash, 600_000);
        var user = db.FindUser("Alice");

        Assert.NotNull(id);
        Assert.NotNull(user);
        Assert.Equal(id, user.Id);
        Assert.Equal("Alice", user.Username);
        Assert.Equal(Salt, user.Salt);
        Assert.Equal(Hash, user.Hash);
        Assert.Equal(600_000, user.Iterations);
        Assert.Null(user.Avatar);
        Assert.InRange(user.CreatedAt, before, DateTimeOffset.UtcNow.AddSeconds(1));
    }

    [Fact]
    public void CreateUser_GivesEachUserItsOwnId()
    {
        var db = new GameDatabase(_path);

        long? alice = db.CreateUser("Alice", Salt, Hash, 1000);
        long? bob = db.CreateUser("Bob", Salt, Hash, 1000);

        Assert.NotNull(alice);
        Assert.NotNull(bob);
        Assert.NotEqual(alice, bob);
    }

    [Theory]
    [InlineData("Alice")]
    [InlineData("alice")]
    [InlineData("ALICE")]
    [InlineData("aLiCe")]
    public void CreateUser_RefusesANameThatDiffersOnlyInCase(string second)
    {
        var db = new GameDatabase(_path);
        db.CreateUser("Alice", Salt, Hash, 1000);

        Assert.Null(db.CreateUser(second, Salt, Hash, 1000));
        Assert.Equal(1, Scalar("SELECT COUNT(*) FROM users"));
        Assert.Equal("Alice", db.FindUser("alice")!.Username);
    }

    [Fact]
    public void CreateUser_StillThrowsForOtherErrors()
    {
        var db = new GameDatabase(_path);

        // A missing salt is a bug, not a taken name: it must throw, not come back as null.
        Assert.ThrowsAny<Exception>(() => db.CreateUser("Alice", null!, Hash, 1000));
        Assert.Equal(0, Scalar("SELECT COUNT(*) FROM users"));
    }

    [Fact]
    public void CreateUser_ABrokenDatabase_ThrowsInsteadOfSayingTheNameIsTaken()
    {
        var db = new GameDatabase(_path);
        Execute("DROP TABLE users");

        Assert.Throws<SqliteException>(() => db.CreateUser("Alice", Salt, Hash, 1000));
    }

    [Theory]
    [InlineData("alice")]
    [InlineData("ALICE")]
    public void FindUser_IgnoresCase_AndReturnsTheStoredCasing(string asked)
    {
        var db = new GameDatabase(_path);
        db.CreateUser("Alice", Salt, Hash, 1000);

        Assert.Equal("Alice", db.FindUser(asked)!.Username);
    }

    [Fact]
    public void FindUser_UnknownName_ReturnsNull()
    {
        var db = new GameDatabase(_path);
        db.CreateUser("Alice", Salt, Hash, 1000);

        Assert.Null(db.FindUser("Bob"));
        Assert.Null(db.FindUser("Alic"));
        Assert.Null(db.FindUser(""));
    }

    [Fact]
    public void ThaiUsernames_AreStoredAndFoundExactly()
    {
        var db = new GameDatabase(_path);

        Assert.NotNull(db.CreateUser("สมชาย", Salt, Hash, 1000));
        Assert.Null(db.CreateUser("สมชาย", Salt, Hash, 1000));
        Assert.Equal("สมชาย", db.FindUser("สมชาย")!.Username);
    }

    // ---- Saving a match ----

    [Fact]
    public void SaveMatch_StoresTheMatchBothPlayersEveryShotAndBothFleets()
    {
        var db = new GameDatabase(_path);
        long alice = db.CreateUser("Alice", Salt, Hash, 1000)!.Value;
        long bob = db.CreateUser("Bob", Salt, Hash, 1000)!.Value;
        var started = new DateTimeOffset(2026, 10, 19, 14, 0, 0, TimeSpan.FromHours(7));
        var ended = started.AddMinutes(5);
        var shots = new[]
        {
            new ShotRecord(1, alice, new Coord(0, 0), Hit: true, Auto: false),
            new ShotRecord(2, bob, new Coord(7, 7), Hit: false, Auto: true),
            new ShotRecord(3, alice, new Coord(0, 1), Hit: true, Auto: false),
        };
        var record = new MatchRecord(started, ended, alice,
            new[] { new MatchPlayerRecord(alice, FleetA), new MatchPlayerRecord(bob, FleetB) }, shots);

        long id = db.SaveMatch(record);

        Assert.Equal(
            new[] { $"{id}|2026-10-19T07:00:00.0000000+00:00|2026-10-19T07:05:00.0000000+00:00|{alice}" },
            Rows("SELECT id, started_at, ended_at, winner_id FROM matches"));
        Assert.Equal(
            new[] { $"{id}|{alice}|Bob|1", $"{id}|{bob}|Alice|0" },
            Rows("SELECT match_id, user_id, opponent_name, won FROM match_players ORDER BY user_id"));
        Assert.Equal(
            new[] { $"{id}|1|{alice}|0|0|1|0", $"{id}|2|{bob}|7|7|0|1", $"{id}|3|{alice}|0|1|1|0" },
            Rows("SELECT match_id, turn, by_user_id, \"row\", col, hit, auto FROM shots ORDER BY turn"));
        Assert.Equal(Cells(alice, FleetA).Concat(Cells(bob, FleetB)).OrderBy(s => s, StringComparer.Ordinal),
            Rows("SELECT user_id, ship, \"row\", col FROM fleets").OrderBy(s => s, StringComparer.Ordinal));
    }

    [Fact]
    public void SaveMatch_CountsShotsHitsAndBestStreakForEachPlayer()
    {
        var db = new GameDatabase(_path);
        long alice = db.CreateUser("Alice", Salt, Hash, 1000)!.Value;
        long bob = db.CreateUser("Bob", Salt, Hash, 1000)!.Value;
        // Alice: H H M H H H  → 6 shots, 5 hits, best streak 3.
        // Bob:   M H M H H    → 5 shots, 3 hits, best streak 2. Bob's misses must not reset Alice.
        var shots = Shots(
            (1, alice, true), (2, bob, false),
            (3, alice, true), (4, bob, true),
            (5, alice, false), (6, bob, false),
            (7, alice, true), (8, bob, true),
            (9, alice, true), (10, bob, true),
            (11, alice, true));

        db.SaveMatch(Match(alice, bob, winner: alice, shots));

        Assert.Equal(
            new[] { $"{alice}|6|5|3", $"{bob}|5|3|2" },
            Rows("SELECT user_id, shots, hits, best_streak FROM match_players ORDER BY user_id"));
    }

    [Fact]
    public void SaveMatch_CountsStreaksInTurnOrder_EvenIfShotsArriveOutOfOrder()
    {
        var db = new GameDatabase(_path);
        long alice = db.CreateUser("Alice", Salt, Hash, 1000)!.Value;
        long bob = db.CreateUser("Bob", Salt, Hash, 1000)!.Value;
        // In turn order Alice goes H M H: best streak 1, not 2.
        var shots = Shots((5, alice, true), (1, alice, true), (3, alice, false));

        db.SaveMatch(Match(alice, bob, winner: alice, shots));

        Assert.Equal(1, Scalar($"SELECT best_streak FROM match_players WHERE user_id = {alice}"));
    }

    [Fact]
    public void SaveMatch_AutoShotsAreCountedAndKeepTheirFlag()
    {
        var db = new GameDatabase(_path);
        long alice = db.CreateUser("Alice", Salt, Hash, 1000)!.Value;
        long bob = db.CreateUser("Bob", Salt, Hash, 1000)!.Value;
        var shots = new[]
        {
            new ShotRecord(1, alice, new Coord(0, 0), Hit: true, Auto: true),
            new ShotRecord(3, alice, new Coord(0, 1), Hit: true, Auto: false),
        };

        db.SaveMatch(Match(alice, bob, winner: alice, shots));

        Assert.Equal(new[] { "1|1", "3|0" }, Rows("SELECT turn, auto FROM shots ORDER BY turn"));
        Assert.Equal($"{alice}|2|2|2",
            Rows($"SELECT user_id, shots, hits, best_streak FROM match_players WHERE user_id = {alice}").Single());
    }

    [Fact]
    public void SaveMatch_APlayerWhoNeverFired_GetsZeroes()
    {
        var db = new GameDatabase(_path);
        long alice = db.CreateUser("Alice", Salt, Hash, 1000)!.Value;
        long bob = db.CreateUser("Bob", Salt, Hash, 1000)!.Value;

        db.SaveMatch(Match(alice, bob, winner: alice, Shots((1, alice, true))));

        Assert.Equal($"{bob}|0|0|0",
            Rows($"SELECT user_id, shots, hits, best_streak FROM match_players WHERE user_id = {bob}").Single());
    }

    [Fact]
    public void SaveMatch_TheLoserCanBeListedFirst()
    {
        var db = new GameDatabase(_path);
        long alice = db.CreateUser("Alice", Salt, Hash, 1000)!.Value;
        long bob = db.CreateUser("Bob", Salt, Hash, 1000)!.Value;

        db.SaveMatch(Match(alice, bob, winner: bob, Shots((1, bob, true))));

        Assert.Equal(new[] { $"{alice}|0", $"{bob}|1" },
            Rows("SELECT user_id, won FROM match_players ORDER BY user_id"));
        Assert.Equal(bob, Scalar("SELECT winner_id FROM matches"));
    }

    [Fact]
    public void SaveMatch_TwoMatches_GetDifferentIds_AndKeepTheirOwnRows()
    {
        var db = new GameDatabase(_path);
        long alice = db.CreateUser("Alice", Salt, Hash, 1000)!.Value;
        long bob = db.CreateUser("Bob", Salt, Hash, 1000)!.Value;

        long first = db.SaveMatch(Match(alice, bob, winner: alice, Shots((1, alice, true))));
        long second = db.SaveMatch(Match(alice, bob, winner: bob, Shots((1, bob, true), (2, alice, false))));

        Assert.NotEqual(first, second);
        Assert.Equal(1, Scalar($"SELECT COUNT(*) FROM shots WHERE match_id = {first}"));
        Assert.Equal(2, Scalar($"SELECT COUNT(*) FROM shots WHERE match_id = {second}"));
        Assert.Equal(CellsPerFleet, Scalar($"SELECT COUNT(*) FROM fleets WHERE match_id = {first} AND user_id = {alice}"));
    }

    [Fact]
    public void SaveMatch_OpponentName_IsTheStoredUsername()
    {
        var db = new GameDatabase(_path);
        long alice = db.CreateUser("Alice", Salt, Hash, 1000)!.Value;
        long bob = db.CreateUser("BoB", Salt, Hash, 1000)!.Value;

        db.SaveMatch(Match(alice, bob, winner: alice, Shots()));

        Assert.Equal("BoB", Column<string>($"SELECT opponent_name FROM match_players WHERE user_id = {alice}").Single());
    }

    // ---- Nothing half-saved ----

    [Fact]
    public void SaveMatch_WhenAnInsertFailsPartway_SavesNothing()
    {
        var db = new GameDatabase(_path);
        long alice = db.CreateUser("Alice", Salt, Hash, 1000)!.Value;
        const long noSuchUser = 999;

        // The matches row goes in first; Alice's row then has no opponent name (no such user) and fails.
        var ex = Assert.Throws<SqliteException>(() =>
            db.SaveMatch(Match(alice, noSuchUser, winner: alice, Shots((1, alice, true)))));
        Assert.Equal(19, ex.SqliteErrorCode); // SQLITE_CONSTRAINT

        AssertNothingSaved();
    }

    [Fact]
    public void SaveMatch_WhenTheLastShotFails_SavesNothing()
    {
        var db = new GameDatabase(_path);
        long alice = db.CreateUser("Alice", Salt, Hash, 1000)!.Value;
        long bob = db.CreateUser("Bob", Salt, Hash, 1000)!.Value;

        // Everything else is written before the shots; a repeated turn fails on the very last insert.
        Assert.Throws<SqliteException>(() =>
            db.SaveMatch(Match(alice, bob, winner: alice, Shots((1, alice, true), (2, bob, false), (2, bob, true)))));

        AssertNothingSaved();
    }

    [Fact]
    public void SaveMatch_AfterAFailure_TheNextMatchSavesNormally()
    {
        var db = new GameDatabase(_path);
        long alice = db.CreateUser("Alice", Salt, Hash, 1000)!.Value;
        long bob = db.CreateUser("Bob", Salt, Hash, 1000)!.Value;
        Assert.Throws<SqliteException>(() =>
            db.SaveMatch(Match(alice, bob, winner: alice, Shots((1, alice, true), (1, alice, true)))));

        db.SaveMatch(Match(alice, bob, winner: alice, Shots((1, alice, true))));

        Assert.Equal(1, Scalar("SELECT COUNT(*) FROM matches"));
        Assert.Equal(1, Scalar("SELECT COUNT(*) FROM shots"));
    }

    public static TheoryData<string> BadMatches => new() { "one player", "three players", "same user twice", "winner not playing", "shot by a stranger" };

    [Theory]
    [MemberData(nameof(BadMatches))]
    public void SaveMatch_RefusesABadRecord_AndSavesNothing(string problem)
    {
        var db = new GameDatabase(_path);
        long alice = db.CreateUser("Alice", Salt, Hash, 1000)!.Value;
        long bob = db.CreateUser("Bob", Salt, Hash, 1000)!.Value;
        long carol = db.CreateUser("Carol", Salt, Hash, 1000)!.Value;
        var a = new MatchPlayerRecord(alice, FleetA);
        var b = new MatchPlayerRecord(bob, FleetB);
        var c = new MatchPlayerRecord(carol, FleetA);
        var now = DateTimeOffset.UtcNow;
        var record = problem switch
        {
            "one player" => new MatchRecord(now, now, alice, new[] { a }, Shots()),
            "three players" => new MatchRecord(now, now, alice, new[] { a, b, c }, Shots()),
            "same user twice" => new MatchRecord(now, now, alice, new[] { a, a }, Shots()),
            "winner not playing" => new MatchRecord(now, now, carol, new[] { a, b }, Shots()),
            "shot by a stranger" => new MatchRecord(now, now, alice, new[] { a, b }, Shots((1, carol, true))),
            _ => throw new ArgumentOutOfRangeException(nameof(problem)),
        };

        Assert.Throws<ArgumentException>(() => db.SaveMatch(record));

        AssertNothingSaved();
    }

    // ---- Helpers ----

    // Two legal fleets: four horizontal ships of four on rows 0–3 (A) and rows 4–7 (B).
    private static readonly IReadOnlyList<IReadOnlyList<Coord>> FleetA = Fleet(0);
    private static readonly IReadOnlyList<IReadOnlyList<Coord>> FleetB = Fleet(4);
    private const int CellsPerFleet = GameRules.ShipCount * GameRules.ShipLength;

    private static IReadOnlyList<IReadOnlyList<Coord>> Fleet(int firstRow) =>
        Enumerable.Range(firstRow, GameRules.ShipCount)
            .Select(row => (IReadOnlyList<Coord>)Enumerable.Range(0, GameRules.ShipLength).Select(col => new Coord(row, col)).ToList())
            .ToList();

    private static IEnumerable<string> Cells(long userId, IReadOnlyList<IReadOnlyList<Coord>> fleet) =>
        fleet.SelectMany((ship, index) => ship.Select(c => $"{userId}|{index}|{c.Row}|{c.Col}"));

    private static ShotRecord[] Shots(params (int Turn, long By, bool Hit)[] shots) =>
        shots.Select(s => new ShotRecord(s.Turn, s.By, new Coord(s.Turn % 8, s.Turn / 8), s.Hit, Auto: false)).ToArray();

    private static MatchRecord Match(long first, long second, long winner, ShotRecord[] shots) =>
        new(DateTimeOffset.UtcNow.AddMinutes(-5), DateTimeOffset.UtcNow, winner,
            new[] { new MatchPlayerRecord(first, FleetA), new MatchPlayerRecord(second, FleetB) }, shots);

    private void AssertNothingSaved()
    {
        Assert.Equal(0, Scalar("SELECT COUNT(*) FROM matches"));
        Assert.Equal(0, Scalar("SELECT COUNT(*) FROM match_players"));
        Assert.Equal(0, Scalar("SELECT COUNT(*) FROM shots"));
        Assert.Equal(0, Scalar("SELECT COUNT(*) FROM fleets"));
    }

    // Raw reads straight from the file, so the tests don't trust GameDatabase to check itself.
    private SqliteConnection Connect()
    {
        var connection = new SqliteConnection(
            new SqliteConnectionStringBuilder { DataSource = _path, Pooling = false }.ToString());
        connection.Open();
        return connection;
    }

    private long Scalar(string sql)
    {
        using var connection = Connect();
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        return Convert.ToInt64(command.ExecuteScalar());
    }

    private void Execute(string sql)
    {
        using var connection = Connect();
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.ExecuteNonQuery();
    }

    private List<T> Column<T>(string sql)
    {
        using var connection = Connect();
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        using var reader = command.ExecuteReader();
        var values = new List<T>();
        while (reader.Read()) values.Add(reader.GetFieldValue<T>(0));
        return values;
    }

    private List<string> Rows(string sql)
    {
        using var connection = Connect();
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        using var reader = command.ExecuteReader();
        var rows = new List<string>();
        while (reader.Read())
            rows.Add(string.Join("|", Enumerable.Range(0, reader.FieldCount).Select(i => Convert.ToString(reader.GetValue(i)))));
        return rows;
    }
}

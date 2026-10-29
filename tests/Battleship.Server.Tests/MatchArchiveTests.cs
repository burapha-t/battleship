using Battleship.Core.Protocol;
using Battleship.Server.Data;
using Battleship.Server.Engine;
using Battleship.Server.Lobby;
using Microsoft.Data.Sqlite;
using static Battleship.Server.Tests.EngineSetup;

namespace Battleship.Server.Tests;

/// <summary>Keeps every match the engine hands over; can be told to throw.</summary>
internal sealed class FakeArchive : IMatchArchive
{
    public List<MatchRecord> Saved { get; } = new();
    public List<(string MatchId, IReadOnlyList<string> PlayerIds)> Ids { get; } = new();
    public bool Fail { get; set; }

    public void Save(MatchRecord match, string matchId, IReadOnlyList<string> playerIds)
    {
        if (Fail) throw new IOException("disk full");
        Saved.Add(match);
        Ids.Add((matchId, playerIds));
    }
}

// DB-2: a finished match between two accounts is saved once, at matchEnd.
public class MatchArchiveTests : IDisposable
{
    private const long AliceId = 11, BobId = 22;

    private readonly string _folder = Path.Combine(Path.GetTempPath(), "battleship-archive-" + Guid.NewGuid().ToString("N"));

    public void Dispose()
    {
        GameDatabase.ClearPool(Path.Combine(_folder, "test.db"));
        if (Directory.Exists(_folder)) Directory.Delete(_folder, recursive: true);
    }

    private static (EngineSetup Setup, FakeArchive Archive) LoggedIn(long? alice = AliceId, long? bob = BobId)
    {
        var archive = new FakeArchive();
        var setup = new EngineSetup(archive: archive);
        setup.Join("p1", "Alice").UserId = alice;
        setup.Join("p2", "Bob").UserId = bob;
        setup.Engine.FindMatch("p1");
        setup.Engine.FindMatch("p2");
        setup.Engine.Place("p1", FleetA);
        setup.Engine.Place("p2", FleetB);
        return (setup, archive);
    }

    [Fact]
    public void FinishedMatchBetweenTwoAccounts_IsHandedOverWithEverything()
    {
        var (setup, archive) = LoggedIn();
        var match = setup.Engine.Matches.Single();

        setup.PlayToWin("p2");

        var saved = Assert.Single(archive.Saved);
        Assert.Equal(BobId, saved.WinnerId);
        Assert.True(saved.StartedAt <= saved.EndedAt);
        Assert.Equal(match.StartedAt, saved.StartedAt);
        Assert.Collection(saved.Players,
            p => { Assert.Equal(AliceId, p.UserId); Assert.Equal(Cells(FleetA), p.Fleet.SelectMany(s => s)); },
            p => { Assert.Equal(BobId, p.UserId); Assert.Equal(Cells(FleetB), p.Fleet.SelectMany(s => s)); });
        Assert.Equal(match.Moves.Count, saved.Shots.Count);
        Assert.Equal(match.Moves.Select(m => m.TurnNumber), saved.Shots.Select(s => s.Turn));
        Assert.Equal(match.Moves.Select(m => m.By == "p1" ? AliceId : BobId), saved.Shots.Select(s => s.ByUserId));
        Assert.Equal(match.Moves.Select(m => (m.Cell, m.Hit, m.Auto)), saved.Shots.Select(s => (s.Cell, s.Hit, s.Auto)));
    }

    [Fact]
    public void TimeoutShots_KeepTheirAutoFlag()
    {
        var (setup, archive) = LoggedIn();
        var match = setup.Engine.Matches.Single();
        setup.Engine.TurnExpired(match.Id, match.TurnNumber);

        setup.PlayToWin("p1");

        Assert.True(Assert.Single(archive.Saved).Shots[0].Auto);
    }

    [Fact]
    public void SavedOnce_EvenWhenMessagesArriveAfterTheEnd()
    {
        var (setup, archive) = LoggedIn();
        setup.PlayToWin("p1");

        setup.Engine.Fire("p2", 7, 7);
        setup.Engine.Rematch("p1");
        setup.Engine.Leave("p2");

        Assert.Single(archive.Saved);
    }

    [Theory]
    [InlineData(null, BobId)]
    [InlineData(AliceId, null)]
    [InlineData(null, null)]
    public void AGuestInTheMatch_SavesNothing(long? alice, long? bob)
    {
        var (setup, archive) = LoggedIn(alice, bob);

        var last = setup.PlayToWin("p1");

        Assert.Single(Messages<MatchEnd>(last));
        Assert.Empty(archive.Saved);
    }

    [Fact]
    public void LoggingInMidMatch_DoesNotMakeItSaved()
    {
        var (setup, archive) = LoggedIn(alice: null);

        setup.Roster.Find("p1")!.UserId = AliceId;
        setup.PlayToWin("p1");

        Assert.Empty(archive.Saved);
    }

    [Fact]
    public void DisconnectMidMatch_SavesNothing()
    {
        var (setup, archive) = LoggedIn();
        setup.Engine.Fire(setup.Engine.Matches.Single().ActivePlayerId!, 7, 7);

        setup.Engine.PlayerLeft("p1");

        Assert.Empty(archive.Saved);
    }

    [Fact]
    public void ResetMidMatch_SavesNothing()
    {
        var (setup, archive) = LoggedIn();
        setup.Engine.Fire(setup.Engine.Matches.Single().ActivePlayerId!, 7, 7);

        setup.Engine.Reset();

        Assert.Empty(archive.Saved);
    }

    [Fact]
    public void ARematch_IsSavedAsASecondMatch()
    {
        var (setup, archive) = LoggedIn();
        setup.PlayToWin("p1");
        setup.Engine.Rematch("p1");
        setup.Engine.Rematch("p2");
        setup.Engine.Place("p1", FleetA);
        setup.Engine.Place("p2", FleetB);

        setup.PlayToWin("p2");

        Assert.Equal(new[] { AliceId, BobId }, archive.Saved.Select(m => m.WinnerId));
    }

    [Fact]
    public void AFailingArchive_DoesNotStopMatchEnd()
    {
        var (setup, archive) = LoggedIn();
        archive.Fail = true;

        var last = setup.PlayToWin("p1");

        Assert.Equal("p1", Messages<MatchEnd>(last).Single().WinnerId);
        Assert.Equal(MatchPhase.MatchEnd, setup.Engine.Matches.Single().Phase);
    }

    // ---- Through DatabaseWorker into a real file ----

    [Fact]
    public async Task Worker_WritesTheWholeMatchToTheFile()
    {
        var database = new GameDatabase(Path.Combine(_folder, "test.db"));
        long alice = database.CreateUser("Alice", new byte[16], new byte[32], 1)!.Value;
        long bob = database.CreateUser("Bob", new byte[16], new byte[32], 1)!.Value;
        var worker = new DatabaseWorker(database);
        var setup = new EngineSetup(archive: worker);
        setup.Join("p1", "Alice").UserId = alice;
        setup.Join("p2", "Bob").UserId = bob;
        var match = setup.StartPlaying();
        setup.PlayToWin("p1");

        await worker.CompleteAsync();

        using var connection = new SqliteConnection($"Data Source={database.Path};Pooling=False");
        connection.Open();
        long Count(string sql) { using var c = connection.CreateCommand(); c.CommandText = sql; return (long)c.ExecuteScalar()!; }
        Assert.Equal(1, Count("SELECT COUNT(*) FROM matches"));
        Assert.Equal(alice, Count("SELECT winner_id FROM matches"));
        Assert.Equal(2, Count("SELECT COUNT(*) FROM match_players"));
        Assert.Equal(match.Moves.Count, Count("SELECT COUNT(*) FROM shots"));
        Assert.Equal(32, Count("SELECT COUNT(*) FROM fleets"));
    }

    [Fact]
    public async Task Worker_GuestOpponentLeavesMidMatch_WritesNoMatchStatsOrBadges()
    {
        var database = new GameDatabase(Path.Combine(_folder, "test.db"));
        long alice = database.CreateUser("Alice", new byte[16], new byte[32], 1)!.Value;
        var worker = new DatabaseWorker(database);
        var setup = new EngineSetup(archive: worker);
        setup.Join("p1", "Alice").UserId = alice;
        setup.Join("p2", "Guest");
        setup.Engine.FindMatch("p1");
        setup.Engine.FindMatch("p2");
        setup.Engine.Place("p1", FleetA);
        setup.Engine.Place("p2", FleetB);
        setup.Engine.Fire(setup.Engine.Matches.Single().ActivePlayerId!, 7, 7);

        setup.Engine.Leave("p2");
        await worker.CompleteAsync();

        using var connection = new SqliteConnection($"Data Source={database.Path};Pooling=False");
        connection.Open();
        long Count(string sql) { using var c = connection.CreateCommand(); c.CommandText = sql; return (long)c.ExecuteScalar()!; }
        Assert.Equal(0, Count("SELECT COUNT(*) FROM matches"));
        Assert.Equal(0, Count("SELECT COUNT(*) FROM match_players"));
        Assert.Equal(0, Count("SELECT COUNT(*) FROM achievements"));
        Assert.Empty(database.GetAchievements(alice).Badges);
        Assert.Equal(0, database.GetHistory(alice, 1).Stats.MatchCount);
    }

    [Fact]
    public async Task Worker_LogsAFailedSave_AndKeepsWorking()
    {
        var database = new GameDatabase(Path.Combine(_folder, "test.db"));
        var worker = new DatabaseWorker(database);
        // Users 11 and 22 don't exist, so the foreign keys reject this save.
        var (setup, _) = LoggedIn();
        setup.PlayToWin("p1");
        var record = setup.Engine.Matches.Single().ToRecord(DateTimeOffset.UtcNow)!;
        bool ranAfter = false;

        worker.Save(record, "m1", new[] { "p1", "p2" });
        worker.Enqueue(_ => ranAfter = true);
        await worker.CompleteAsync();

        Assert.True(ranAfter);
        using var connection = new SqliteConnection($"Data Source={database.Path};Pooling=False");
        connection.Open();
        using var count = connection.CreateCommand();
        count.CommandText = "SELECT COUNT(*) FROM matches";
        Assert.Equal(0L, (long)count.ExecuteScalar()!);
    }
}

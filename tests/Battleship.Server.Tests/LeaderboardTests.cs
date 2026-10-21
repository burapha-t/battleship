using Battleship.Core;
using Battleship.Core.Protocol;
using Battleship.Server.Data;
using Battleship.Server.Host;
using Microsoft.Data.Sqlite;

namespace Battleship.Server.Tests;

// LB-1: GameDatabase.GetLeaderboard, the data behind the leaderboard reply.
public class LeaderboardTests : IDisposable
{
    private static readonly DateTimeOffset Start = new(2026, 10, 19, 7, 0, 0, TimeSpan.Zero);

    private readonly string _folder = Path.Combine(Path.GetTempPath(), "battleship-leaderboard-" + Guid.NewGuid().ToString("N"));
    private readonly GameDatabase _database;
    private int _minutes;

    public LeaderboardTests()
    {
        _database = new GameDatabase(Path.Combine(_folder, "test.db"));
    }

    public void Dispose()
    {
        SqliteConnection.ClearAllPools();
        if (Directory.Exists(_folder)) Directory.Delete(_folder, recursive: true);
    }

    [Fact]
    public void NoSavedMatches_NoRows()
    {
        User("Alice");

        Assert.Empty(_database.GetLeaderboard().Rows);
    }

    [Fact]
    public void RanksByPoints_TheTotalWins()
    {
        long alice = User("Alice"), bob = User("Bob"), carol = User("Carol");
        Save(bob, alice, winner: bob, firstHits: 1, firstShots: 2, secondHits: 1, secondShots: 2);
        Save(bob, carol, winner: bob, firstHits: 1, firstShots: 2, secondHits: 1, secondShots: 2);
        Save(carol, alice, winner: carol, firstHits: 1, firstShots: 2, secondHits: 1, secondShots: 2);

        Assert.Equal(new[] { (1, "Bob", 2, 50.0), (2, "Carol", 1, 50.0), (3, "Alice", 0, 50.0) }, Rows());
    }

    [Fact]
    public void SamePoints_HigherAccuracyRanksFirst()
    {
        long alice = User("Alice"), bob = User("Bob");
        // One win each; Alice 1/4 overall, Bob 3/4.
        Save(alice, bob, winner: alice, firstHits: 1, firstShots: 2, secondHits: 2, secondShots: 2);
        Save(bob, alice, winner: bob, firstHits: 1, firstShots: 2, secondHits: 0, secondShots: 2);

        Assert.Equal(new[] { (1, "Bob", 1, 75.0), (2, "Alice", 1, 25.0) }, Rows());
    }

    [Fact]
    public void SamePointsAndAccuracy_ShareARank_InNameOrder()
    {
        long dan = User("dan"), bob = User("Bob"), carol = User("Carol"), alice = User("alice");
        // Bob and dan: 1 win at 50%. Carol: 0 wins at 50%. alice: 1 win at 100%.
        Save(dan, carol, winner: dan, firstHits: 1, firstShots: 2, secondHits: 1, secondShots: 2);
        Save(bob, carol, winner: bob, firstHits: 1, firstShots: 2, secondHits: 1, secondShots: 2);
        Save(alice, carol, winner: alice, firstHits: 2, firstShots: 2, secondHits: 1, secondShots: 2);

        Assert.Equal(new[] { (1, "alice", 1, 100.0), (2, "Bob", 1, 50.0), (2, "dan", 1, 50.0), (4, "Carol", 0, 50.0) }, Rows());
    }

    [Fact]
    public void TiesAreJudgedOnTheAccuracySent()
    {
        long alice = User("Alice"), bob = User("Bob"), carol = User("Carol");
        // 2/3 and 667/1000 both send 66.7, so they share rank 1.
        Save(alice, carol, winner: alice, firstHits: 2, firstShots: 3, secondHits: 0, secondShots: 1);
        Save(bob, carol, winner: bob, firstHits: 667, firstShots: 1000, secondHits: 0, secondShots: 1);

        Assert.Equal(new[] { (1, "Alice", 1, 66.7), (1, "Bob", 1, 66.7), (3, "Carol", 0, 0.0) }, Rows());
    }

    [Fact]
    public void APlayerWithNoShots_HasAccuracyZero()
    {
        long alice = User("Alice"), bob = User("Bob");
        Save(alice, bob, winner: alice, firstHits: 1, firstShots: 1, secondHits: 0, secondShots: 0);

        Assert.Equal((2, "Bob", 0, 0.0), Rows()[1]);
    }

    [Fact]
    public void TimeoutShots_CountTowardAccuracy()
    {
        long alice = User("Alice"), bob = User("Bob");
        // Alice: 1 hit + 3 timeout misses = 25%.
        Save(alice, bob, winner: alice, firstHits: 1, firstShots: 4, secondHits: 0, secondShots: 1, firstAuto: true);

        Assert.Equal((1, "Alice", 1, 25.0), Rows()[0]);
    }

    [Fact]
    public void AccountsWithNoMatches_AreLeftOut()
    {
        long alice = User("Alice"), bob = User("Bob");
        User("Carol");
        Save(alice, bob, winner: alice, firstHits: 1, firstShots: 1, secondHits: 0, secondShots: 1);

        Assert.Equal(new[] { "Alice", "Bob" }, Rows().Select(r => r.Item2));
    }

    [Fact]
    public void OnlyTheTop50_AreSent()
    {
        var users = Enumerable.Range(0, 60).Select(i => User($"P{i:D2}")).ToList();
        for (int i = 0; i < users.Count; i += 2)
            Save(users[i], users[i + 1], winner: users[i], firstHits: 1, firstShots: 1, secondHits: 0, secondShots: 1);

        var rows = _database.GetLeaderboard().Rows;

        Assert.Equal(Leaderboard.MaxRows, rows.Count);
        Assert.All(rows.Take(30), r => Assert.Equal((1, 1), (r.Rank, r.Points)));
        Assert.All(rows.Skip(30), r => Assert.Equal((31, 0), (r.Rank, r.Points)));
    }

    [Fact]
    public async Task DashboardReset_LeavesTheLeaderboardUnchanged()
    {
        long alice = User("Alice"), bob = User("Bob");
        Save(alice, bob, winner: alice, firstHits: 3, firstShots: 4, secondHits: 1, secondShots: 4);
        string before = ProtocolJson.Serialize(_database.GetLeaderboard());

        var host = new GameHost(TimeSpan.FromHours(1), new Random(1), _database);
        using var stop = new CancellationTokenSource();
        var running = host.RunAsync(stop.Token);
        host.Post(new HostInput.ResetRequested());
        var deadline = DateTime.UtcNow.AddSeconds(5);
        while (!host.Snapshot.Activity.Any(e => e.Text.StartsWith("RESET")) && DateTime.UtcNow < deadline)
            await Task.Delay(10);
        stop.Cancel();
        await running;

        Assert.Contains(host.Snapshot.Activity, e => e.Text.StartsWith("RESET"));
        Assert.Equal(before, ProtocolJson.Serialize(_database.GetLeaderboard()));
    }

    // ---- Helpers ----

    private long User(string name) => _database.CreateUser(name, new byte[16], new byte[32], 1)!.Value;

    /// <summary>
    /// Saves one match. Each player fires their shots, the first hits of them
    /// hitting, on cells of their own; the first player's misses can be timeout shots.
    /// </summary>
    private void Save(long first, long second, long winner, int firstHits, int firstShots, int secondHits, int secondShots,
        bool firstAuto = false)
    {
        var shots = new List<ShotRecord>();
        int turn = 1;
        for (int i = 0; i < firstShots; i++)
            shots.Add(new ShotRecord(turn++, first, new Coord(i / 8 % 8, i % 8), i < firstHits, firstAuto && i >= firstHits));
        for (int i = 0; i < secondShots; i++)
            shots.Add(new ShotRecord(turn++, second, new Coord(i / 8 % 8, i % 8), i < secondHits, false));
        var ended = Start.AddMinutes(_minutes++);
        _database.SaveMatch(new MatchRecord(ended.AddMinutes(-3), ended, winner,
            new[] { new MatchPlayerRecord(first, Fleet(0)), new MatchPlayerRecord(second, Fleet(4)) }, shots));
    }

    private static IReadOnlyList<IReadOnlyList<Coord>> Fleet(int firstRow) =>
        Enumerable.Range(0, GameRules.ShipCount)
            .Select(i => (IReadOnlyList<Coord>)Enumerable.Range(0, GameRules.ShipLength).Select(c => new Coord(firstRow + i, c)).ToList())
            .ToList();

    private List<(int, string, int, double)> Rows() =>
        _database.GetLeaderboard().Rows.Select(r => (r.Rank, r.Name, r.Points, r.Accuracy)).ToList();
}

using System.Threading.Channels;
using Battleship.Server.Engine;
using Battleship.Core.Protocol;

namespace Battleship.Server.Data;

/// <summary>
/// Runs database work on one background task, one job at a time, so a slow
/// disk never delays the game loop (database.md rule 3). Jobs run in the order
/// they were queued, so a history request queued after a save sees that match.
/// Badge unlocks (#41) follow each saved match; a failure never rolls back it.
/// A job that throws is logged and the worker carries on.
/// </summary>
public sealed class DatabaseWorker : IMatchArchive
{
    private readonly Channel<Action<GameDatabase>> _jobs =
        Channel.CreateUnbounded<Action<GameDatabase>>(new UnboundedChannelOptions { SingleReader = true });
    private readonly GameDatabase _database;
    private readonly Task _running;

    private readonly Action<string, ProtocolMessage>? _reply;

    public DatabaseWorker(GameDatabase database, Action<string, ProtocolMessage>? reply = null)
    {
        _database = database;
        _reply = reply;
        _running = Task.Run(RunAsync);
    }

    /// <summary>Queues a job. Safe from any thread; returns at once.</summary>
    public void Enqueue(Action<GameDatabase> job) => _jobs.Writer.TryWrite(job);

    /// <summary>Queues a finished match for <see cref="GameDatabase.SaveMatch"/>.</summary>
    public void Save(MatchRecord match, string matchId, IReadOnlyList<string> playerIds) => Enqueue(database =>
    {
        long id = database.SaveMatch(match);
        Console.WriteLine($"Saved match #{id} to the database");
        // #41: the match transaction has committed; a badge failure cannot undo it.
        for (int i = 0; i < match.Players.Count; i++)
        {
            try
            {
                var badges = database.UnlockAchievements(match.Players[i].UserId, id, match.EndedAt);
                if (badges.Count > 0)
                    _reply?.Invoke(playerIds[i], new AchievementUnlocked { MatchId = matchId, Badges = badges });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Could not unlock badges for match {matchId}: {ex.Message}");
            }
        }
    });

    /// <summary>Stops taking jobs and waits for the queued ones to finish.</summary>
    public Task CompleteAsync()
    {
        _jobs.Writer.TryComplete();
        return _running;
    }

    private async Task RunAsync()
    {
        await foreach (var job in _jobs.Reader.ReadAllAsync())
        {
            try
            {
                job(_database);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Database job failed: {ex.Message}");
            }
        }
    }
}

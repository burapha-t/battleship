using System.Threading.Channels;
using Battleship.Server.Engine;

namespace Battleship.Server.Data;

/// <summary>
/// Runs database work on one background task, one job at a time, so a slow
/// disk never delays the game loop (database.md rule 3). Jobs run in the order
/// they were queued, so a history request queued after a save sees that match.
/// A job that throws is logged and the worker carries on.
/// </summary>
public sealed class DatabaseWorker : IMatchArchive
{
    private readonly Channel<Action<GameDatabase>> _jobs =
        Channel.CreateUnbounded<Action<GameDatabase>>(new UnboundedChannelOptions { SingleReader = true });
    private readonly GameDatabase _database;
    private readonly Task _running;

    public DatabaseWorker(GameDatabase database)
    {
        _database = database;
        _running = Task.Run(RunAsync);
    }

    /// <summary>Queues a job. Safe from any thread; returns at once.</summary>
    public void Enqueue(Action<GameDatabase> job) => _jobs.Writer.TryWrite(job);

    /// <summary>Queues a finished match for <see cref="GameDatabase.SaveMatch"/>.</summary>
    public void Save(MatchRecord match) => Enqueue(database =>
    {
        long id = database.SaveMatch(match);
        Console.WriteLine($"Saved match #{id} to the database");
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

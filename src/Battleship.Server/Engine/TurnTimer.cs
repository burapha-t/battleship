using Battleship.Server.Host;

namespace Battleship.Server.Engine;

/// <summary>
/// The real <see cref="ITurnTimer"/>: posts <see cref="HostInput.TurnExpired"/>
/// after the turn's duration. Start and Cancel are only called from the game
/// loop; a late expiry is harmless because the engine drops stale turns.
/// </summary>
public sealed class TurnTimer : ITurnTimer
{
    private readonly Action<HostInput> _post;
    private readonly TimeSpan _duration;
    private readonly Dictionary<string, CancellationTokenSource> _running = new();

    /// <param name="post">Where expiries go: <see cref="GameHost.Post"/>.</param>
    /// <param name="duration"><c>GameRules.TurnSeconds</c> in the real server; tests may shorten it.</param>
    public TurnTimer(Action<HostInput> post, TimeSpan duration)
    {
        _post = post;
        _duration = duration;
    }

    public void Start(string matchId, int turnNumber)
    {
        Cancel(matchId);
        var cancel = new CancellationTokenSource();
        _running[matchId] = cancel;
        _ = ExpireAsync(matchId, turnNumber, cancel.Token);
    }

    public void Cancel(string matchId)
    {
        if (!_running.Remove(matchId, out var cancel)) return;
        cancel.Cancel();
        cancel.Dispose();
    }

    private async Task ExpireAsync(string matchId, int turnNumber, CancellationToken cancellationToken)
    {
        try
        {
            await Task.Delay(_duration, cancellationToken);
            _post(new HostInput.TurnExpired(matchId, turnNumber));
        }
        catch (OperationCanceledException)
        {
            // The turn ended in time.
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Turn timer for {matchId} failed: {ex}");
        }
    }
}

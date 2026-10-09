namespace Battleship.Server.Engine;

/// <summary>
/// The per-match turn timer. On expiry it posts
/// <c>TurnExpired(matchId, turnNumber)</c> to the game loop and touches
/// nothing else. Tests swap in a fake.
/// </summary>
public interface ITurnTimer
{
    /// <summary>Starts the match's timer, replacing any running one.</summary>
    void Start(string matchId, int turnNumber);

    /// <summary>Stops the match's timer, if one is running.</summary>
    void Cancel(string matchId);
}

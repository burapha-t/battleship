using Battleship.Server.Data;

namespace Battleship.Server.Engine;

/// <summary>
/// Where <see cref="MatchEngine"/> hands each finished match between two
/// accounts. Save must return at once: the real one queues the write off the
/// game loop (<see cref="DatabaseWorker"/>); tests keep a list.
/// </summary>
public interface IMatchArchive
{
    /// <param name="matchId">The wire id, for <c>achievementUnlocked</c>.</param>
    /// <param name="playerIds">Connection ids in the order of <c>match.Players</c>.</param>
    void Save(MatchRecord match, string matchId, IReadOnlyList<string> playerIds);
}

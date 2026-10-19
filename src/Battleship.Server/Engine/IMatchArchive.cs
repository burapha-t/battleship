using Battleship.Server.Data;

namespace Battleship.Server.Engine;

/// <summary>
/// Where <see cref="MatchEngine"/> hands each finished match between two
/// accounts. Save must return at once: the real one queues the write off the
/// game loop (<see cref="DatabaseWorker"/>); tests keep a list.
/// </summary>
public interface IMatchArchive
{
    void Save(MatchRecord match);
}

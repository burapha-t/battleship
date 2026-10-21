using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

// The 8 client → server verbs (protocol.md §5). Property order is wire order.
namespace Battleship.Core.Protocol
{
    /// <summary><c>join</c>: the player submits a nickname.</summary>
    public sealed class Join : ProtocolMessage
    {
        public Join() : base("join") { }

        public string Nickname { get; set; } = "";
    }

    /// <summary><c>findMatch</c>: the player pressed <i>Start game</i>.</summary>
    public sealed class FindMatch : ProtocolMessage
    {
        public FindMatch() : base("findMatch") { }
    }

    /// <summary><c>place</c>: the player's 4 ships, each 4 cells.</summary>
    public sealed class Place : ProtocolMessage
    {
        public Place() : base("place") { }

        public IReadOnlyList<IReadOnlyList<Coord>> Ships { get; set; } = Array.Empty<IReadOnlyList<Coord>>();
    }

    /// <summary>
    /// <c>fire</c>: the active player's target cell. A <c>fire</c> without
    /// <c>row</c> or <c>col</c> is malformed, not a shot at [0,0].
    /// </summary>
    public sealed class Fire : ProtocolMessage
    {
        public Fire() : base("fire") { }

        [JsonRequired]
        public int Row { get; set; }

        [JsonRequired]
        public int Col { get; set; }
    }

    /// <summary><c>rematch</c>: the player pressed Rematch.</summary>
    public sealed class Rematch : ProtocolMessage
    {
        public Rematch() : base("rematch") { }
    }

    /// <summary><c>leave</c>: the player pressed Home after a match ended.</summary>
    public sealed class Leave : ProtocolMessage
    {
        public Leave() : base("leave") { }
    }

    /// <summary>
    /// <c>historyList</c>: one page of my match history, 1 = newest. A missing
    /// or smaller page is page 1.
    /// </summary>
    public sealed class HistoryList : ProtocolMessage
    {
        public HistoryList() : base("historyList") { }

        public int Page { get; set; } = 1;
    }

    /// <summary><c>leaderboardGet</c>: the top players over all saved matches. Anyone may ask.</summary>
    public sealed class LeaderboardGet : ProtocolMessage
    {
        public LeaderboardGet() : base("leaderboardGet") { }
    }

    /// <summary><c>achievementsGet</c>: my badges and best stats (#41). A guest gets zeros.</summary>
    public sealed class AchievementsGet : ProtocolMessage
    {
        public AchievementsGet() : base("achievementsGet") { }
    }
}

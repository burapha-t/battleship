using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

// The 11 client → server verbs (protocol.md §5). Property order is wire order.
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

    /// <summary><c>profileGet</c>: my picture, shown badges, rank and wins (#42). A guest gets an empty one.</summary>
    public sealed class ProfileGet : ProtocolMessage
    {
        public ProfileGet() : base("profileGet") { }
    }

    /// <summary>
    /// <c>profileUpdate</c>: save my picture and the badges I show (#42). Both
    /// are required; a missing one is <c>invalid-profile</c>, not "no change".
    /// </summary>
    public sealed class ProfileUpdate : ProtocolMessage
    {
        public ProfileUpdate() : base("profileUpdate") { }

        /// <summary>"" for none, or a code from <see cref="Battleship.Core.Avatars.Catalogue"/>.</summary>
        public string? Avatar { get; set; }

        /// <summary>At most 3 earned badge codes, no repeats, in display order.</summary>
        public IReadOnlyList<string>? ShownBadges { get; set; }
    }
}

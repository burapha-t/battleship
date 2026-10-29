using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

// The 14 client → server verbs (protocol.md §5). Property order is wire order.
namespace Battleship.Core.Protocol
{
    /// <summary><c>join</c>: the player submits a nickname.</summary>
    public sealed class Join : ProtocolMessage
    {
        public Join() : base("join") { }

        public string Nickname { get; set; } = "";
    }

    /// <summary>
    /// <c>signup</c>: create an account and log in to it (LOGIN-1). A missing
    /// or null field counts as empty. A plain class, so logging it prints only
    /// its type name, never the password.
    /// </summary>
    public sealed class Signup : ProtocolMessage
    {
        public Signup() : base("signup") { }

        public string Username { get; set; } = "";

        public string Password { get; set; } = "";
    }

    /// <summary>
    /// <c>login</c>: log in to an existing account (LOGIN-1). A missing or null
    /// field counts as empty. A plain class, like <see cref="Signup"/>.
    /// </summary>
    public sealed class Login : ProtocolMessage
    {
        public Login() : base("login") { }

        public string Username { get; set; } = "";

        public string Password { get; set; } = "";
    }

    /// <summary><c>findMatch</c>: the player pressed <i>Start game</i>.</summary>
    public sealed class FindMatch : ProtocolMessage
    {
        public FindMatch() : base("findMatch") { }

        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public string? MatchKey { get; set; }
    }

    /// <summary><c>cancelSearch</c>: leave matchmaking and return to the idle lobby.</summary>
    public sealed class CancelSearch : ProtocolMessage
    {
        public CancelSearch() : base("cancelSearch") { }
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

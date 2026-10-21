using System;
using System.Collections.Generic;

// The 17 server → client events (protocol.md §4). Property order is wire order.
namespace Battleship.Core.Protocol
{
    /// <summary>First frame on every connection.</summary>
    public sealed class Connected : ProtocolMessage
    {
        public Connected() : base("connected") { }

        public string Id { get; set; } = "";
        public int ProtocolVersion { get; set; } = ProtocolJson.ProtocolVersion;
    }

    /// <summary>Nickname accepted; <see cref="Nickname"/> is the final one.</summary>
    public sealed class Welcome : ProtocolMessage
    {
        public Welcome() : base("welcome") { }

        public string Id { get; set; } = "";
        public string Nickname { get; set; } = "";
    }

    /// <summary>
    /// <c>lobby</c>: every connected client and its status. Named
    /// LobbyUpdate so it doesn't clash with the server's Lobby namespace.
    /// </summary>
    public sealed class LobbyUpdate : ProtocolMessage
    {
        public LobbyUpdate() : base("lobby") { }

        public int Count { get; set; }
        public IReadOnlyList<LobbyClient> Clients { get; set; } = Array.Empty<LobbyClient>();
    }

    /// <summary>One row of <see cref="LobbyUpdate.Clients"/>; <see cref="Name"/> is null until <c>welcome</c>.</summary>
    public sealed class LobbyClient
    {
        public string Id { get; set; } = "";
        public string? Name { get; set; }
        public string Status { get; set; } = "";
    }

    /// <summary>The <see cref="LobbyClient.Status"/> values (protocol.md §4 <c>lobby</c>).</summary>
    public static class LobbyStatus
    {
        public const string Connecting = "connecting";
        public const string Idle = "idle";
        public const string Searching = "searching";
        public const string Placing = "placing";
        public const string InMatch = "in-match";
    }

    /// <summary>A new match, rematches included: clear both boards and place ships.</summary>
    public sealed class MatchStart : ProtocolMessage
    {
        public MatchStart() : base("matchStart") { }

        public string MatchId { get; set; } = "";
        public IReadOnlyList<PlayerInfo> Players { get; set; } = Array.Empty<PlayerInfo>();
        public string FirstPlayerId { get; set; } = "";
    }

    /// <summary>A player in <see cref="MatchStart"/> and <see cref="MatchEnd"/>.</summary>
    public sealed class PlayerInfo
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public int Score { get; set; }
    }

    /// <summary>A placement was accepted. Carries only the id, never the cells.</summary>
    public sealed class Placed : ProtocolMessage
    {
        public Placed() : base("placed") { }

        public string Id { get; set; } = "";
    }

    /// <summary>A turn begins.</summary>
    public sealed class Turn : ProtocolMessage
    {
        public Turn() : base("turn") { }

        public string ActivePlayerId { get; set; } = "";
        public int Seconds { get; set; } = GameRules.TurnSeconds;
        public int TurnNumber { get; set; }
    }

    /// <summary>A shot resolved, including a timeout auto-fire.</summary>
    public sealed class FireResult : ProtocolMessage
    {
        public const string Hit = "hit";
        public const string Miss = "miss";

        public FireResult() : base("fireResult") { }

        public string By { get; set; } = "";
        public string Target { get; set; } = "";
        public int Row { get; set; }
        public int Col { get; set; }
        public string Result { get; set; } = Miss;
        public bool Sunk { get; set; }
        public IReadOnlyList<Coord>? SunkCells { get; set; }
        public bool AllSunk { get; set; }
        public bool Auto { get; set; }
    }

    /// <summary>All of one player's ships are sunk. Scores already include the win.</summary>
    public sealed class MatchEnd : ProtocolMessage
    {
        public MatchEnd() : base("matchEnd") { }

        public string MatchId { get; set; } = "";
        public string WinnerId { get; set; } = "";
        public IReadOnlyList<PlayerInfo> Players { get; set; } = Array.Empty<PlayerInfo>();
    }

    /// <summary>One player has asked for a rematch.</summary>
    public sealed class RematchPending : ProtocolMessage
    {
        public RematchPending() : base("rematchPending") { }

        public string From { get; set; } = "";
    }

    /// <summary>The other player's socket closed.</summary>
    public sealed class OpponentLeft : ProtocolMessage
    {
        public OpponentLeft() : base("opponentLeft") { }

        public string Id { get; set; } = "";
    }

    /// <summary>
    /// <c>history</c>: the answer to <c>historyList</c>, only ever about the
    /// player who asked. A guest gets zeros and no matches.
    /// </summary>
    public sealed class History : ProtocolMessage
    {
        /// <summary>Matches per page.</summary>
        public const int PageSize = 20;

        public History() : base("history") { }

        public int Page { get; set; } = 1;
        public HistoryStats Stats { get; set; } = new HistoryStats();

        /// <summary>Newest first, at most <see cref="PageSize"/>.</summary>
        public IReadOnlyList<HistoryMatch> Matches { get; set; } = Array.Empty<HistoryMatch>();

        /// <summary>True when an older page exists.</summary>
        public bool More { get; set; }
    }

    /// <summary>Totals over all my saved matches. Rates are percentages, one decimal; 0 with no matches.</summary>
    public sealed class HistoryStats
    {
        public int MatchCount { get; set; }
        public int WinCount { get; set; }
        public int LoseCount { get; set; }
        public double WinRate { get; set; }
        public double Accuracy { get; set; }
    }

    /// <summary>One saved match from my side.</summary>
    public sealed class HistoryMatch
    {
        public bool Won { get; set; }
        public string Opponent { get; set; } = "";

        /// <summary>UTC, e.g. <c>2026-10-19T07:00:00Z</c>.</summary>
        public string EndedAt { get; set; } = "";

        /// <summary>My hits / my shots in this match, a percentage with one decimal.</summary>
        public double Accuracy { get; set; }
    }

    /// <summary>
    /// <c>leaderboard</c>: the answer to <c>leaderboardGet</c>, sent only to the
    /// player who asked. All-time, from the database; RESET doesn't change it.
    /// </summary>
    public sealed class Leaderboard : ProtocolMessage
    {
        /// <summary>Rows sent at most.</summary>
        public const int MaxRows = 50;

        public Leaderboard() : base("leaderboard") { }

        /// <summary>Best first, at most <see cref="MaxRows"/>.</summary>
        public IReadOnlyList<LeaderboardRow> Rows { get; set; } = Array.Empty<LeaderboardRow>();
    }

    /// <summary>
    /// One ranked account. Points = wins; accuracy = hits / shots, a percentage
    /// with one decimal, 0 with no shots. Ties on both share a rank (1, 1, 3).
    /// </summary>
    public sealed class LeaderboardRow
    {
        public int Rank { get; set; }
        public string Name { get; set; } = "";
        public int Points { get; set; }
        public double Accuracy { get; set; }
    }

    /// <summary>
    /// <c>achievements</c>: the answer to <c>achievementsGet</c> (#41), only
    /// about the player who asked. A guest gets zeros and no badges. Named
    /// AchievementList because <see cref="Battleship.Core.Achievements"/> holds the rules.
    /// </summary>
    public sealed class AchievementList : ProtocolMessage
    {
        public AchievementList() : base("achievements") { }

        /// <summary>Wins over all my saved matches.</summary>
        public int Wins { get; set; }

        /// <summary>My best single-match hits / shots, a percentage with one decimal.</summary>
        public double BestAccuracy { get; set; }

        /// <summary>My longest run of hits in one match.</summary>
        public int BestStreak { get; set; }

        /// <summary>Every badge I own, oldest first.</summary>
        public IReadOnlyList<BadgeUnlock> Badges { get; set; } = Array.Empty<BadgeUnlock>();
    }

    /// <summary>
    /// <c>achievementUnlocked</c>: badges the match <see cref="MatchId"/> just
    /// earned me (#41), sent only to me after <c>matchEnd</c>.
    /// </summary>
    public sealed class AchievementUnlocked : ProtocolMessage
    {
        public AchievementUnlocked() : base("achievementUnlocked") { }

        public string MatchId { get; set; } = "";
        public IReadOnlyList<BadgeUnlock> Badges { get; set; } = Array.Empty<BadgeUnlock>();
    }

    /// <summary>
    /// <c>profile</c>: the answer to <c>profileGet</c> or a saved
    /// <c>profileUpdate</c> (#42), only about the player who asked. Earned
    /// badges and best stats are in <see cref="AchievementList"/>.
    /// </summary>
    public sealed class Profile : ProtocolMessage
    {
        public Profile() : base("profile") { }

        /// <summary>Not logged in, so Save is off. A guest's other fields are empty.</summary>
        public bool Guest { get; set; }

        /// <summary>"" for none, or a code from <see cref="Battleship.Core.Avatars.Catalogue"/>.</summary>
        public string Avatar { get; set; } = "";

        /// <summary>0–3 badge codes, in the order I chose.</summary>
        public IReadOnlyList<string> ShownBadges { get; set; } = Array.Empty<string>();

        /// <summary>My place on the leaderboard over every account; null with no saved match.</summary>
        public int? Rank { get; set; }

        /// <summary>Wins over all my saved matches.</summary>
        public int Wins { get; set; }
    }

    /// <summary>One owned badge: a code from <see cref="Battleship.Core.Achievements.Catalogue"/>.</summary>
    public sealed class BadgeUnlock
    {
        public string Code { get; set; } = "";

        /// <summary>UTC, e.g. <c>2026-10-19T07:00:00Z</c>.</summary>
        public string UnlockedAt { get; set; } = "";
    }

    /// <summary>The dashboard RESET button was pressed.</summary>
    public sealed class Reset : ProtocolMessage
    {
        public Reset() : base("reset") { }
    }

    /// <summary>A client message was rejected. Branch on <see cref="Code"/>.</summary>
    public sealed class Error : ProtocolMessage
    {
        public Error() : base("error") { }

        public string Code { get; set; } = ErrorCodes.Unknown;
        public string Message { get; set; } = "";
    }

    /// <summary>The <see cref="Error.Code"/> values (protocol.md §4 <c>error</c>).</summary>
    public static class ErrorCodes
    {
        public const string BadNickname = "bad-nickname";
        public const string InvalidPlacement = "invalid-placement";
        public const string NotYourTurn = "not-your-turn";
        public const string AlreadyFired = "already-fired";
        public const string OutOfRange = "out-of-range";
        public const string NotInMatch = "not-in-match";
        public const string InvalidProfile = "invalid-profile";
        public const string NotLoggedIn = "not-logged-in";
        public const string Unknown = "unknown";
    }
}

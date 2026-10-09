using System;
using System.Collections.Generic;

// The 12 server → client events (protocol.md §4). Property order is wire order.
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
        public const string Unknown = "unknown";
    }
}

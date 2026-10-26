using Battleship.Core.Protocol;
using Battleship.Server.Net;

namespace Battleship.Server.Host;

/// <summary>
/// Everything that can change game state, posted to <see cref="GameHost"/>'s
/// single loop (SRV-0).
/// </summary>
public abstract record HostInput
{
    private HostInput() { }

    /// <summary>A socket was accepted. Always the session's first input.</summary>
    public sealed record Connected(ClientSession Session) : HostInput;

    /// <summary>A parsed frame from a client.</summary>
    public sealed record Message(string PlayerId, ProtocolMessage Body) : HostInput;

    /// <summary>A socket closed. Posted exactly once per session, always last.</summary>
    public sealed record Disconnected(string PlayerId) : HostInput;

    /// <summary>A turn timer ran out. Dropped if that turn is no longer current.</summary>
    public sealed record TurnExpired(string MatchId, int TurnNumber) : HostInput;

    /// <summary>The dashboard RESET button was pressed.</summary>
    public sealed record ResetRequested : HostInput;

    /// <summary>A database job finished and has a reply for one player (e.g. <c>history</c>).</summary>
    public sealed record DatabaseReply(string PlayerId, ProtocolMessage Reply) : HostInput;

    /// <summary>
    /// A <c>signup</c> or <c>login</c> job finished (LOGIN-1). With an
    /// <paramref name="Error"/>, that is the refusal to send; without one, the
    /// password was right and the player becomes <paramref name="Username"/>
    /// (users.id <paramref name="UserId"/>). Never holds a password or hash.
    /// </summary>
    public sealed record AccountChecked(string PlayerId, bool SignedUp, long UserId, string Username, Error? Error) : HostInput
    {
        public static AccountChecked Refused(string playerId, string code, string message) =>
            new(playerId, false, 0, "", new Error { Code = code, Message = message });
    }
}

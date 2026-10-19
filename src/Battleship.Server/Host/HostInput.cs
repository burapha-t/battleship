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

    /// <summary>Invalidate active game connections when the account logs out.</summary>
    public sealed record AccountLoggedOut(string AccountId) : HostInput;

    /// <summary>The dashboard RESET button was pressed.</summary>
    public sealed record ResetRequested : HostInput;

    /// <summary>A database job finished and has a reply for one player (e.g. <c>history</c>).</summary>
    public sealed record DatabaseReply(string PlayerId, ProtocolMessage Reply) : HostInput;
}

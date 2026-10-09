using Battleship.Core.Protocol;

namespace Battleship.Server.Host;

/// <summary>
/// "Send this message to these player ids": what the match engine hands back
/// to <see cref="GameHost"/>, which does the sending (SRV-0).
/// </summary>
public sealed record Outbound(IReadOnlyList<string> To, ProtocolMessage Message)
{
    public static Outbound ToPlayer(string playerId, ProtocolMessage message) => new(new[] { playerId }, message);

    public static Outbound Error(string playerId, string code, string message) =>
        ToPlayer(playerId, new Error { Code = code, Message = message });
}

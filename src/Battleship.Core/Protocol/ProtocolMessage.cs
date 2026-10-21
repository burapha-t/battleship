using System.Text.Json.Serialization;

namespace Battleship.Core.Protocol
{
    /// <summary>
    /// Base of the wire messages in protocol.md, including #41/#42. <see cref="Type"/> is the
    /// <c>"type"</c> field and is always written first.
    /// </summary>
    public abstract class ProtocolMessage
    {
        protected ProtocolMessage(string type)
        {
            Type = type;
        }

        [JsonPropertyOrder(-1)]
        public string Type { get; }
    }
}

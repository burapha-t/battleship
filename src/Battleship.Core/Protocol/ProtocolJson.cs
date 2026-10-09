using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Battleship.Core.Protocol
{
    /// <summary>
    /// Reads and writes protocol.md frames: one compact JSON object per line,
    /// camelCase names, cells as <c>[row,col]</c> arrays.
    /// </summary>
    public static class ProtocolJson
    {
        public const int ProtocolVersion = 1;

        private static readonly JsonSerializerOptions Options = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            Converters = { new CoordConverter() },
        };

        private static readonly Dictionary<string, Type> Types = new Dictionary<string, Type>
        {
            ["join"] = typeof(Join),
            ["findMatch"] = typeof(FindMatch),
            ["place"] = typeof(Place),
            ["fire"] = typeof(Fire),
            ["rematch"] = typeof(Rematch),
            ["connected"] = typeof(Connected),
            ["welcome"] = typeof(Welcome),
            ["lobby"] = typeof(LobbyUpdate),
            ["matchStart"] = typeof(MatchStart),
            ["placed"] = typeof(Placed),
            ["turn"] = typeof(Turn),
            ["fireResult"] = typeof(FireResult),
            ["matchEnd"] = typeof(MatchEnd),
            ["rematchPending"] = typeof(RematchPending),
            ["opponentLeft"] = typeof(OpponentLeft),
            ["reset"] = typeof(Reset),
            ["error"] = typeof(Error),
        };

        /// <summary>
        /// Reads one line. Returns null for an unknown <c>type</c> or a
        /// malformed line, and never throws (protocol.md §1 rules 1–3).
        /// Unknown fields are ignored.
        /// </summary>
        public static ProtocolMessage? Parse(string? line)
        {
            if (string.IsNullOrWhiteSpace(line)) return null;
            try
            {
                using var document = JsonDocument.Parse(line);
                var root = document.RootElement;
                if (root.ValueKind != JsonValueKind.Object ||
                    !root.TryGetProperty("type", out var type) ||
                    type.ValueKind != JsonValueKind.String ||
                    !Types.TryGetValue(type.GetString()!, out var messageType))
                    return null;

                return (ProtocolMessage?)root.Deserialize(messageType, Options);
            }
            catch (JsonException)
            {
                return null;
            }
        }

        /// <summary>One line of compact JSON, without the trailing <c>\n</c>.</summary>
        public static string Serialize(ProtocolMessage message) =>
            JsonSerializer.Serialize(message, message.GetType(), Options);

        // A cell is [row, col] on the wire, not {"row":..,"col":..}.
        private sealed class CoordConverter : JsonConverter<Coord>
        {
            public override Coord Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
            {
                if (reader.TokenType != JsonTokenType.StartArray) throw NotACell();
                int row = ReadInt(ref reader);
                int col = ReadInt(ref reader);
                if (!reader.Read() || reader.TokenType != JsonTokenType.EndArray) throw NotACell();
                return new Coord(row, col);
            }

            public override void Write(Utf8JsonWriter writer, Coord value, JsonSerializerOptions options)
            {
                writer.WriteStartArray();
                writer.WriteNumberValue(value.Row);
                writer.WriteNumberValue(value.Col);
                writer.WriteEndArray();
            }

            private static int ReadInt(ref Utf8JsonReader reader)
            {
                if (!reader.Read() || reader.TokenType != JsonTokenType.Number || !reader.TryGetInt32(out int value))
                    throw NotACell();
                return value;
            }

            private static JsonException NotACell() => new JsonException("A cell must be [row, col].");
        }
    }
}

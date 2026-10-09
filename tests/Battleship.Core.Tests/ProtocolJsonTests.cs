using System.Text.Json;
using Battleship.Core.Protocol;

namespace Battleship.Core.Tests;

public class ProtocolJsonTests
{
    // Every "frame" in the golden transcript, as raw compact JSON.
    private static List<string> TranscriptFrames()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "match-transcript.jsonl");
        var frames = new List<string>();
        foreach (var line in File.ReadAllLines(path))
        {
            if (line.Length == 0) continue;
            using var document = JsonDocument.Parse(line);
            frames.Add(document.RootElement.GetProperty("frame").GetRawText());
        }
        return frames;
    }

    [Fact]
    public void EveryTranscriptFrame_ParsesAndSerializesBackToTheSameJson()
    {
        foreach (var frame in TranscriptFrames())
        {
            var message = ProtocolJson.Parse(frame);

            Assert.True(message != null, $"Did not parse: {frame}");
            Assert.Equal(frame, ProtocolJson.Serialize(message!));
        }
    }

    [Fact]
    public void Transcript_CoversAll17Types()
    {
        var types = TranscriptFrames().Select(frame => ProtocolJson.Parse(frame)!.GetType()).ToHashSet();

        Assert.Equal(17, types.Count);
    }

    [Fact]
    public void Fire_ParsesRowAndCol()
    {
        var fire = Assert.IsType<Fire>(ProtocolJson.Parse("{\"type\":\"fire\",\"row\":3,\"col\":5}"));

        Assert.Equal(3, fire.Row);
        Assert.Equal(5, fire.Col);
    }

    [Fact]
    public void Place_ParsesCellsAsCoords()
    {
        var place = Assert.IsType<Place>(ProtocolJson.Parse(
            "{\"type\":\"place\",\"ships\":[[[0,0],[0,1],[0,2],[0,3]],[[2,1],[3,1],[4,1],[5,1]]]}"));

        Assert.Equal(2, place.Ships.Count);
        Assert.Equal(new Coord(5, 1), place.Ships[1][3]);
    }

    [Fact]
    public void NullFields_AreWritten()
    {
        var lobby = new LobbyUpdate
        {
            Count = 1,
            Clients = new[] { new LobbyClient { Id = "p1", Name = null, Status = LobbyStatus.Connecting } },
        };

        Assert.Equal(
            "{\"type\":\"lobby\",\"count\":1,\"clients\":[{\"id\":\"p1\",\"name\":null,\"status\":\"connecting\"}]}",
            ProtocolJson.Serialize(lobby));
        Assert.Contains("\"sunkCells\":null", ProtocolJson.Serialize(new FireResult()));
    }

    [Fact]
    public void NewlineInAValue_IsEscaped()
    {
        var json = ProtocolJson.Serialize(new Welcome { Id = "p1", Nickname = "a\nb" });

        Assert.DoesNotContain('\n', json);
        Assert.Equal("a\nb", Assert.IsType<Welcome>(ProtocolJson.Parse(json)).Nickname);
    }

    [Fact]
    public void UnknownType_ReturnsNull()
    {
        Assert.Null(ProtocolJson.Parse("{\"type\":\"chat\",\"text\":\"hi\"}"));
    }

    [Fact]
    public void UnknownField_IsIgnored()
    {
        var join = Assert.IsType<Join>(ProtocolJson.Parse("{\"type\":\"join\",\"nickname\":\"Alice\",\"color\":\"red\"}"));

        Assert.Equal("Alice", join.Nickname);
    }

    [Theory]
    [InlineData("not json")]
    [InlineData("{\"type\":\"fire\",\"row\":3")]
    [InlineData("[1,2,3]")]
    [InlineData("\"join\"")]
    [InlineData("{}")]
    [InlineData("{\"type\":7}")]
    [InlineData("{\"type\":null}")]
    [InlineData("{\"type\":\"fire\",\"row\":\"three\",\"col\":5}")]
    [InlineData("{\"type\":\"fire\",\"row\":1.5,\"col\":5}")]
    [InlineData("{\"type\":\"fire\",\"row\":99999999999,\"col\":5}")]
    [InlineData("{\"type\":\"fire\"}")]
    [InlineData("{\"type\":\"place\",\"ships\":[[[0,0,0]]]}")]
    [InlineData("{\"type\":\"place\",\"ships\":[[{\"row\":0,\"col\":0}]]}")]
    [InlineData("{\"type\":\"place\",\"ships\":7}")]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void MalformedLine_ReturnsNull_NeverThrows(string? line)
    {
        Assert.Null(ProtocolJson.Parse(line));
    }
}

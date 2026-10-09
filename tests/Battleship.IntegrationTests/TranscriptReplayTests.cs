using System.Text.Json;
using Battleship.Core;
using Battleship.Core.Protocol;
using Battleship.Server.Host;

namespace Battleship.IntegrationTests;

// Plays the golden transcript's client lines into the real server and checks
// every player receives exactly the transcript's server lines, in order.
public class TranscriptReplayTests
{
    // Hands the server the "random" values the transcript needs, in order.
    private sealed class ScriptedRandom : Random
    {
        public Queue<int> Values { get; } = new();

        public override int Next(int maxValue) => Values.Dequeue();
    }

    private sealed record Line(string From, string To, string Frame);

    private static List<Line> ReadTranscript()
    {
        var lines = new List<Line>();
        foreach (var text in File.ReadAllLines(Path.Combine(AppContext.BaseDirectory, "match-transcript.jsonl")))
        {
            if (text.Length == 0) continue;
            using var document = JsonDocument.Parse(text);
            var root = document.RootElement;
            lines.Add(new Line(root.GetProperty("from").GetString()!, root.GetProperty("to").GetString()!,
                root.GetProperty("frame").GetRawText()));
        }
        return lines;
    }

    // The engine picks an auto-fire cell as Random.Next(n) over the target's
    // unshot cells in row-major order; this is the index of the wanted cell.
    private static int AutoFireIndex(HashSet<Coord> shot, int row, int col)
    {
        int index = 0;
        for (int r = 0; r < GameRules.GridSize; r++)
        {
            for (int c = 0; c < GameRules.GridSize; c++)
            {
                if (r == row && c == col) return index;
                if (!shot.Contains(new Coord(r, c))) index++;
            }
        }
        throw new InvalidOperationException("Cell off the grid.");
    }

    [Fact]
    public async Task Server_SendsExactlyTheGoldenTranscript()
    {
        var random = new ScriptedRandom();
        // Real timers never fire; the transcript's one timeout is posted by hand.
        await using var server = await TestServer.StartAsync(TimeSpan.FromHours(1), random);
        var clients = new Dictionary<string, TestClient>();
        var shotAt = new Dictionary<string, HashSet<Coord>>();
        string matchId = "";
        int turnNumber = 0;
        bool triggered = false;
        int checkedFrames = 0;

        random.Values.Enqueue(1); // m1: the second searcher, Bob, goes first

        try
        {
            foreach (var line in ReadTranscript())
            {
                if (line.From != "server")
                {
                    await clients[line.From].SendRawAsync(line.Frame);
                    triggered = false;
                    continue;
                }

                var expected = ProtocolJson.Parse(line.Frame)!;
                if (expected is Connected)
                {
                    var client = await server.ConnectAsync();
                    Assert.Equal(line.To, client.Id);
                    clients[client.Id] = client;
                    continue;
                }

                // Server frames that no client line caused: do what caused them.
                if (!triggered)
                {
                    switch (expected)
                    {
                        case FireResult { Auto: true } auto:
                            random.Values.Enqueue(AutoFireIndex(shotAt[auto.Target], auto.Row, auto.Col));
                            server.Host.Post(new HostInput.TurnExpired(matchId, turnNumber));
                            triggered = true;
                            break;
                        case Reset:
                            random.Values.Enqueue(1); // m3: the second searcher, Alice, goes first
                            (await server.Dashboard.PostAsync("/api/reset", null)).EnsureSuccessStatusCode();
                            triggered = true;
                            break;
                        case OpponentLeft left:
                            await clients[left.Id].DisposeAsync();
                            triggered = true;
                            break;
                    }
                }

                string actual = await clients[line.To].NextRawAsync();
                checkedFrames++;
                if (expected is Error error)
                {
                    // Error texts are placeholders (fixtures README): compare the code.
                    Assert.Equal(error.Code, Assert.IsType<Error>(ProtocolJson.Parse(actual)).Code);
                }
                else
                {
                    Assert.Equal(line.Frame, actual);
                }

                switch (expected)
                {
                    case MatchStart start:
                        matchId = start.MatchId;
                        shotAt = start.Players.ToDictionary(p => p.Id, _ => new HashSet<Coord>());
                        break;
                    case Turn turn:
                        turnNumber = turn.TurnNumber;
                        break;
                    case FireResult shot:
                        shotAt[shot.Target].Add(new Coord(shot.Row, shot.Col));
                        break;
                }
            }

            Assert.Equal(ReadTranscript().Count(l => l.From == "server" && !l.Frame.Contains("\"connected\"")), checkedFrames);
            foreach (var client in new[] { clients["p1"], clients["p3"] })
                await client.AssertNothingAsync(TimeSpan.FromMilliseconds(200));
        }
        finally
        {
            foreach (var client in clients.Values) await client.DisposeAsync();
        }
    }
}

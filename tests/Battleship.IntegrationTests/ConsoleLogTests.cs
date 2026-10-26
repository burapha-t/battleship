using Battleship.Core.Protocol;

namespace Battleship.IntegrationTests;

// Console.Out is one per process, so tests that capture it run alone.
[CollectionDefinition(Name, DisableParallelization = true)]
public sealed class ConsoleCollection
{
    public const string Name = "Console";
}

// What the server prints. A skipped line may hold a password (protocol.md §1 rule 3).
[Collection(ConsoleCollection.Name)]
public class ConsoleLogTests
{
    [Fact]
    public async Task SkippedLine_IsLoggedWithoutItsContent()
    {
        var original = Console.Out;
        var captured = new StringWriter();
        Console.SetOut(captured);
        try
        {
            await using var server = await TestServer.StartAsync();
            await using var client = await server.ConnectAsync();

            // A login with its closing brace missing: not a message, so skipped.
            await client.SendRawAsync("{\"type\":\"login\",\"username\":\"Alice\",\"password\":\"MARKER-4711\"");
            await client.SendAsync(new Join { Nickname = "Alice" });
            await client.NextAsync<Welcome>();
        }
        finally
        {
            Console.SetOut(original);
        }

        string text = captured.ToString();
        Assert.Contains("[p1] skipped", text);
        Assert.DoesNotContain("MARKER-4711", text);
    }
}

using System.Text.Json;
using Battleship.Core.Protocol;

namespace Battleship.IntegrationTests;

// QA-1, plus the SRV-1 / SRV-2 / SRV-3 / SRV-5 checks that need a real socket.
public class HarnessTests
{
    [Fact]
    public async Task TwoClients_SeeConnected_Welcome_Lobby()
    {
        await using var server = await TestServer.StartAsync();

        await using var alice = await server.ConnectAsync();
        Assert.Equal("p1", alice.Id);
        await alice.SendAsync(new Join { Nickname = "Alice" });
        Assert.Equal("{\"type\":\"welcome\",\"id\":\"p1\",\"nickname\":\"Alice\"}", await alice.NextRawAsync());
        Assert.Equal("{\"type\":\"lobby\",\"count\":1,\"clients\":[{\"id\":\"p1\",\"name\":\"Alice\",\"status\":\"idle\"}]}",
            await alice.NextRawAsync());

        await using var bob = await server.ConnectAsync();
        Assert.Equal("p2", bob.Id);
        Assert.Equal("{\"type\":\"lobby\",\"count\":2,\"clients\":[{\"id\":\"p1\",\"name\":\"Alice\",\"status\":\"idle\"}," +
                     "{\"id\":\"p2\",\"name\":null,\"status\":\"connecting\"}]}", await alice.NextRawAsync());

        await bob.SendAsync(new Join { Nickname = "Bob" });
        Assert.Equal("Bob", (await bob.NextAsync<Welcome>()).Nickname);
        string lobby = "{\"type\":\"lobby\",\"count\":2,\"clients\":[{\"id\":\"p1\",\"name\":\"Alice\",\"status\":\"idle\"}," +
                       "{\"id\":\"p2\",\"name\":\"Bob\",\"status\":\"idle\"}]}";
        Assert.Equal(lobby, await bob.NextRawAsync());
        Assert.Equal(lobby, await alice.NextRawAsync());
    }

    [Fact]
    public async Task ClientThatHasNotJoined_GetsNoLobby()
    {
        await using var server = await TestServer.StartAsync();
        await using var stranger = await server.ConnectAsync();

        await using var alice = await server.JoinAsync("Alice");
        await alice.NextAsync<LobbyUpdate>();

        await stranger.AssertNothingAsync(TimeSpan.FromMilliseconds(300));
    }

    [Fact]
    public async Task ThreeClients_JoinAndLeave_EveryJoinedClientGetsTheRightLobby()
    {
        await using var server = await TestServer.StartAsync();
        await using var alice = await server.JoinAsync("Alice");
        await alice.NextAsync<LobbyUpdate>();
        await using var bob = await server.JoinAsync("Bob");
        await bob.NextAsync<LobbyUpdate>();
        await alice.NextAsync<LobbyUpdate>(); // Bob connecting
        await alice.NextAsync<LobbyUpdate>(); // Bob joined
        var carol = await server.JoinAsync("Alice");
        Assert.Equal("Alice (2)", carol.Name);
        await carol.NextAsync<LobbyUpdate>();

        await carol.DisposeAsync();

        foreach (var client in new[] { alice, bob })
        {
            var lobby = await client.WaitForAsync<LobbyUpdate>(l => l.Count == 2);
            Assert.Equal(new[] { "Alice", "Bob" }, lobby.Clients.Select(c => c.Name));
        }
    }

    [Fact]
    public async Task MalformedLine_IsSkipped_AndTheSocketStillWorks()
    {
        await using var server = await TestServer.StartAsync();
        await using var client = await server.ConnectAsync();

        await client.SendRawAsync("not json");
        await client.SendRawAsync("{\"type\":\"chat\",\"text\":\"unknown type\"}");
        await client.SendRawAsync("{\"type\":\"join\",\"nickname\":\"Alice\",\"extra\":true}");

        Assert.Equal("Alice", (await client.NextAsync<Welcome>()).Nickname);
    }

    [Fact]
    public async Task FrameSplitAcrossWrites_AndTwoFramesInOneWrite_AreBothRead()
    {
        await using var server = await TestServer.StartAsync();
        await using var alice = await server.ConnectAsync();

        await alice.WriteRawAsync("{\"type\":\"join\",");
        await Task.Delay(50);
        await alice.WriteRawAsync("\"nickname\":\"Alice\"}\n{\"type\":\"findMatch\"}\n");

        await alice.NextAsync<Welcome>();
        await alice.NextAsync<LobbyUpdate>();
        var lobby = await alice.NextAsync<LobbyUpdate>();
        Assert.Equal(LobbyStatus.Searching, lobby.Clients.Single().Status);
    }

    [Fact]
    public async Task TwoClientsFlooding10000Lines_CauseNoFailure_AndTheServerStillAnswers()
    {
        await using var server = await TestServer.StartAsync();
        await using var a = await server.ConnectAsync();
        await using var b = await server.ConnectAsync();

        var junk = string.Concat(Enumerable.Repeat("{\"type\":\"ping\"}\nnot json\n", 5000));
        await Task.WhenAll(a.WriteRawAsync(junk), b.WriteRawAsync(junk));

        await a.SendAsync(new Join { Nickname = "Alice" });
        Assert.Equal("Alice", (await a.WaitForAsync<Welcome>(timeout: TimeSpan.FromSeconds(30))).Nickname);
        await b.SendAsync(new Join { Nickname = "Bob" });
        Assert.Equal("Bob", (await b.WaitForAsync<Welcome>(timeout: TimeSpan.FromSeconds(30))).Nickname);
    }

    [Fact]
    public async Task Dashboard_ServesThePage_AndTheStateMatchesTheLobby()
    {
        await using var server = await TestServer.StartAsync();
        await using var alice = await server.JoinAsync("Alice");
        await alice.NextAsync<LobbyUpdate>();
        await using var stranger = await server.ConnectAsync();
        await alice.NextAsync<LobbyUpdate>();

        string page = await server.Dashboard.GetStringAsync("/");
        Assert.Contains("Battleship Server", page);

        using var state = JsonDocument.Parse(await server.Dashboard.GetStringAsync("/api/state"));
        var root = state.RootElement;
        Assert.Equal(server.Port, root.GetProperty("tcpPort").GetInt32());
        Assert.Equal(2, root.GetProperty("count").GetInt32());
        var clients = root.GetProperty("clients").EnumerateArray().ToList();
        Assert.Equal("Alice", clients[0].GetProperty("name").GetString());
        Assert.Equal("idle", clients[0].GetProperty("status").GetString());
        Assert.Equal(JsonValueKind.Null, clients[1].GetProperty("name").ValueKind);
        Assert.Equal("connecting", clients[1].GetProperty("status").GetString());
        Assert.Equal("127.0.0.1", clients[1].GetProperty("address").GetString());
    }
}

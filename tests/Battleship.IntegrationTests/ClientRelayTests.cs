using System.Net;
using System.Net.Sockets;
using System.Net.WebSockets;
using System.Text;
using Battleship.Client;
using Battleship.Core.Protocol;
using Battleship.Server.Data;
using Microsoft.AspNetCore.Builder;

namespace Battleship.IntegrationTests;

// CLI-2 / CLI-3: the client's web host and its WebSocket ↔ TCP relay, against the real server.
public class ClientRelayTests
{
    [Fact]
    public void PackagedClient_IncludesV2GlobalPriorArtifact()
    {
        string path = Path.Combine(AppContext.BaseDirectory, "bot", "models", "global_prior_v2.json");
        Assert.True(File.Exists(path), $"Missing packaged model artifact: {path}");
        using var json = System.Text.Json.JsonDocument.Parse(File.ReadAllText(path));
        Assert.Equal(1, json.RootElement.GetProperty("artifact_version").GetInt32());
        Assert.Equal("synthetic", json.RootElement.GetProperty("training").GetProperty("data_source").GetString());
        Assert.Equal(64, json.RootElement.GetProperty("cell_occupancy_probabilities").GetArrayLength());
    }

    private static int FreePort()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        int port = ((IPEndPoint)listener.LocalEndpoint).Port;
        listener.Stop();
        return port;
    }

    private static async Task<WebApplication> StartClientAsync(int serverPort)
    {
        var app = WebHost.Build(new ClientConfig { ServerHost = "127.0.0.1", ServerPort = serverPort, WebPort = FreePort() });
        await app.StartAsync();
        return app;
    }

    private static async Task<ClientWebSocket> OpenAsync(WebApplication client)
    {
        var socket = new ClientWebSocket();
        var http = new Uri(client.Urls.First());
        await socket.ConnectAsync(new Uri($"ws://127.0.0.1:{http.Port}/ws"), CancellationToken.None);
        return socket;
    }

    // One whole WebSocket message as text; null when the relay closed the socket.
    private static async Task<string?> ReceiveAsync(WebSocket socket)
    {
        using var cancel = new CancellationTokenSource(TestClient.DefaultTimeout);
        var buffer = new byte[8192];
        var message = new MemoryStream();
        while (true)
        {
            var result = await socket.ReceiveAsync(buffer, cancel.Token);
            if (result.MessageType == WebSocketMessageType.Close) return null;
            Assert.Equal(WebSocketMessageType.Text, result.MessageType);
            message.Write(buffer, 0, result.Count);
            if (result.EndOfMessage) return Encoding.UTF8.GetString(message.ToArray());
        }
    }

    private static Task SendAsync(WebSocket socket, string text, bool endOfMessage = true) =>
        socket.SendAsync(Encoding.UTF8.GetBytes(text), WebSocketMessageType.Text, endOfMessage, CancellationToken.None);

    [Fact]
    public async Task Relay_PassesFramesUnchanged_OneFramePerMessage_WithoutNewline()
    {
        await using var server = await TestServer.StartAsync();
        await using var client = await StartClientAsync(server.Port);
        using var browser = await OpenAsync(client);

        Assert.Equal("{\"type\":\"connected\",\"id\":\"p1\",\"protocolVersion\":1}", await ReceiveAsync(browser));

        // A message that arrives in two fragments is still one frame.
        await SendAsync(browser, "{\"type\":\"join\",", endOfMessage: false);
        await SendAsync(browser, "\"nickname\":\"Alice\"}");

        Assert.Equal("{\"type\":\"welcome\",\"id\":\"p1\",\"nickname\":\"Alice\"}", await ReceiveAsync(browser));
        Assert.Equal("{\"type\":\"lobby\",\"count\":1,\"clients\":[{\"id\":\"p1\",\"name\":\"Alice\",\"status\":\"idle\"}]}",
            await ReceiveAsync(browser));
    }

    // LOGIN-1: accounts work from any computer, because signup goes over the
    // game connection like everything else.
    [Fact]
    public async Task Signup_ThroughTheRelay_IsWelcomed()
    {
        string folder = Path.Combine(Path.GetTempPath(), "battleship-relay-" + Guid.NewGuid().ToString("N"));
        var database = new GameDatabase(Path.Combine(folder, "test.db"));
        try
        {
            await using var server = await TestServer.StartAsync(database: database);
            await using var client = await StartClientAsync(server.Port);
            using var browser = await OpenAsync(client);
            await ReceiveAsync(browser);

            await SendAsync(browser, "{\"type\":\"signup\",\"username\":\"Alice\",\"password\":\"hunter22\"}");

            Assert.Equal("{\"type\":\"welcome\",\"id\":\"p1\",\"nickname\":\"Alice\"}", await ReceiveAsync(browser));
        }
        finally
        {
            GameDatabase.ClearPool(database.Path);
            if (Directory.Exists(folder)) Directory.Delete(folder, recursive: true);
        }
    }

    [Fact]
    public async Task ClosingTheBrowser_ClosesItsTcpConnection_AndTheLobbyDropsIt()
    {
        await using var server = await TestServer.StartAsync();
        await using var client = await StartClientAsync(server.Port);
        await using var alice = await server.JoinAsync("Alice");
        var browser = await OpenAsync(client);
        await ReceiveAsync(browser);
        await alice.WaitForAsync<LobbyUpdate>(l => l.Count == 2);

        await browser.CloseAsync(WebSocketCloseStatus.NormalClosure, "tab closed", CancellationToken.None);
        browser.Dispose();

        await alice.WaitForAsync<LobbyUpdate>(l => l.Count == 1);
    }

    [Fact]
    public async Task StoppingTheServer_ClosesTheWebSocket()
    {
        var server = await TestServer.StartAsync();
        await using var client = await StartClientAsync(server.Port);
        using var browser = await OpenAsync(client);
        await ReceiveAsync(browser);

        await server.DisposeAsync();

        Assert.Null(await ReceiveAsync(browser));
    }

    [Fact]
    public async Task UnreachableServer_ClosesTheWebSocket()
    {
        await using var client = await StartClientAsync(serverPort: FreePort());
        using var browser = await OpenAsync(client);

        Assert.Null(await ReceiveAsync(browser));
    }

    [Fact]
    public async Task RootPage_IsServed()
    {
        await using var client = await StartClientAsync(serverPort: FreePort());
        using var http = new HttpClient { BaseAddress = new Uri(client.Urls.First()) };

        var response = await http.GetAsync("/");

        response.EnsureSuccessStatusCode();
        Assert.Equal("text/html", response.Content.Headers.ContentType!.MediaType);
    }

    // CLI-1: --lan lets another device on the Wi-Fi play through this computer's client.
    [Fact]
    public async Task Lan_AnotherDeviceCanPlayThroughTheLanAddress()
    {
        var lan = LanAddresses.Get().FirstOrDefault();
        if (lan is null) return; // machine has no network: nothing to test

        await using var server = await TestServer.StartAsync();
        int webPort = FreePort();
        await using var client = WebHost.Build(new ClientConfig
        {
            ServerHost = "127.0.0.1", ServerPort = server.Port, WebPort = webPort, Lan = true,
        });
        await client.StartAsync();

        using var device = new ClientWebSocket();
        await device.ConnectAsync(new Uri($"ws://{lan}:{webPort}/ws"), CancellationToken.None);

        Assert.Equal("{\"type\":\"connected\",\"id\":\"p1\",\"protocolVersion\":1}", await ReceiveAsync(device));
    }

    [Fact]
    public async Task WithoutLan_TheLanAddressIsRefused()
    {
        var lan = LanAddresses.Get().FirstOrDefault();
        if (lan is null) return;

        int webPort = FreePort();
        await using var client = WebHost.Build(new ClientConfig { ServerPort = FreePort(), WebPort = webPort });
        await client.StartAsync();

        using var device = new ClientWebSocket();
        await Assert.ThrowsAnyAsync<Exception>(() =>
            device.ConnectAsync(new Uri($"ws://{lan}:{webPort}/ws"), CancellationToken.None));
    }

    [Fact]
    public void LanFlag_TurnsLanOn_AndItIsOffByDefault()
    {
        Assert.False(ClientConfig.Load([]).Lan);
        Assert.True(ClientConfig.Load(["--lan"]).Lan);
    }
    private static async Task<T> WaitForBrowserAsync<T>(WebSocket browser) where T : ProtocolMessage
    {
        for (int i = 0; i < 40; i++)
        {
            var frame = await ReceiveAsync(browser);
            Assert.NotNull(frame);
            var message = ProtocolJson.Parse(frame!);
            Assert.IsNotType<Error>(message);
            if (message is T wanted) return wanted;
        }
        throw new InvalidOperationException("Expected browser event did not arrive.");
    }

    [Fact]
    public async Task GhostButton_LaunchesPrivateOpponent_ResetAndDisconnectCleanUp()
    {
        await using var server = await TestServer.StartAsync();
        await using var publicPlayer = await server.JoinAsync("Public player");
        await publicPlayer.SendAsync(new FindMatch());
        await using var client = await StartClientAsync(server.Port);
        using var browser = await OpenAsync(client);
        var id = (await WaitForBrowserAsync<Connected>(browser)).Id;
        await SendAsync(browser, "{\"type\":\"join\",\"nickname\":\"Ghost player\"}");
        await WaitForBrowserAsync<Welcome>(browser);
        await SendAsync(browser, "{\"type\":\"playGhost\"}");
        await SendAsync(browser, "{\"type\":\"playGhost\"}");
        var match = await WaitForBrowserAsync<MatchStart>(browser);
        Assert.Contains(match.Players, p => p.Id == id);
        Assert.Contains(match.Players, p => p.Name == "Ghost Fleet");
        Assert.DoesNotContain(match.Players, p => p.Id == publicPlayer.Id);
        await WaitForBrowserAsync<Placed>(browser);
        await publicPlayer.WaitForAsync<LobbyUpdate>(l => l.Count == 3 && l.Clients.Any(p => p.Id == publicPlayer.Id && p.Status == "searching"));

        (await server.Dashboard.PostAsync("/api/reset", null)).EnsureSuccessStatusCode();
        await WaitForBrowserAsync<Reset>(browser);
        // Wait until the old bot has actually disconnected before launching another.
        await publicPlayer.WaitForAsync<LobbyUpdate>(l => l.Count == 2);
        await SendAsync(browser, "{\"type\":\"playGhost\"}");
        await WaitForBrowserAsync<MatchStart>(browser);
        await WaitForBrowserAsync<Placed>(browser);
        await browser.CloseAsync(WebSocketCloseStatus.NormalClosure, "tab closed", CancellationToken.None);
        await publicPlayer.WaitForAsync<LobbyUpdate>(l => l.Count == 1);
    }

    [Fact]
    public async Task GhostButton_MissingPython_ReportsErrorAndKeepsPlayerIdle()
    {
        await using var server = await TestServer.StartAsync();
        await using var client = WebHost.Build(new ClientConfig
        {
            ServerPort = server.Port, WebPort = FreePort(),
            PythonExecutable = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"), "missing-python")
        });
        await client.StartAsync();
        using var browser = await OpenAsync(client);
        await WaitForBrowserAsync<Connected>(browser);
        await SendAsync(browser, "{\"type\":\"join\",\"nickname\":\"Alice\"}");
        await WaitForBrowserAsync<Welcome>(browser);
        await SendAsync(browser, "{\"type\":\"playGhost\"}");
        Error? error = null;
        for (int i = 0; i < 10 && error == null; i++)
            error = ProtocolJson.Parse((await ReceiveAsync(browser))!) as Error;
        Assert.NotNull(error);
        Assert.Contains("Python", error!.Message);
        await using var bob = await server.JoinAsync("Bob");
        await SendAsync(browser, "{\"type\":\"findMatch\"}");
        await bob.SendAsync(new FindMatch());
        var match = await WaitForBrowserAsync<MatchStart>(browser);
        Assert.Contains(match.Players, p => p.Id == bob.Id);
    }

    [Fact]
    public async Task QuitGhost_DuringPlacementAndGameplay_CleansUpAndAllowsAnotherMatch()
    {
        await using var server = await TestServer.StartAsync();
        await using var client = await StartClientAsync(server.Port);
        using var browser = await OpenAsync(client);
        var humanId = (await WaitForBrowserAsync<Connected>(browser)).Id;
        await SendAsync(browser, "{\"type\":\"join\",\"nickname\":\"Alice\"}");
        await WaitForBrowserAsync<Welcome>(browser);

        // Quit the first bot while ships are still being placed.
        await SendAsync(browser, "{\"type\":\"playGhost\"}");
        await WaitForBrowserAsync<MatchStart>(browser);
        await WaitForBrowserAsync<Placed>(browser);
        await SendAsync(browser, "{\"type\":\"quitGhost\"}");
        await WaitForBrowserAsync<OpponentLeft>(browser);
        var idle = await WaitForBrowserAsync<LobbyUpdate>(browser);
        Assert.Single(idle.Clients);
        Assert.Equal(LobbyStatus.Idle, idle.Clients.Single(c => c.Id == humanId).Status);
        Assert.Empty(server.Host.Snapshot.Matches);
        Assert.Equal(0, server.Host.Snapshot.Clients.Single(c => c.Id == humanId).Score);

        // A new managed bot starts normally. Place the human fleet so this
        // quit exercises an active game and its turn timer as well.
        await SendAsync(browser, "{\"type\":\"playGhost\"}");
        await WaitForBrowserAsync<MatchStart>(browser);
        await WaitForBrowserAsync<Placed>(browser);
        var fleet = Battleship.Core.RandomPlacement.Generate(new Random(7));
        await SendAsync(browser, ProtocolJson.Serialize(new Place { Ships = fleet }));
        await WaitForBrowserAsync<Turn>(browser);
        await SendAsync(browser, "{\"type\":\"quitGhost\"}");
        await WaitForBrowserAsync<OpponentLeft>(browser);
        idle = await WaitForBrowserAsync<LobbyUpdate>(browser);
        Assert.Single(idle.Clients);
        Assert.Empty(server.Host.Snapshot.Matches);
        Assert.Equal(0, server.Host.Snapshot.Clients.Single(c => c.Id == humanId).Score);

        // The human connection remains usable for ordinary matchmaking.
        await using var bob = await server.JoinAsync("Bob");
        await SendAsync(browser, "{\"type\":\"findMatch\"}");
        await bob.SendAsync(new FindMatch());
        var humanMatch = await WaitForBrowserAsync<MatchStart>(browser);
        Assert.Contains(humanMatch.Players, p => p.Id == bob.Id);
    }

}

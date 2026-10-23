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
}

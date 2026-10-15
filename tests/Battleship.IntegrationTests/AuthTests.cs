using System.Net;
using System.Net.Http.Json;
using System.Net.WebSockets;
using Battleship.Client;
using Battleship.Server.Auth;
using Microsoft.Extensions.DependencyInjection;

namespace Battleship.IntegrationTests;

public class AuthTests
{
    [Fact]
    public async Task RegisterLoginLogout_PersistsHashedPassword_AndRevokesSession()
    {
        await using var accounts = new TestAccounts();
        await accounts.StartAsync();
        using var http = accounts.Client();
        Assert.Equal(HttpStatusCode.Unauthorized, (await http.GetAsync("/api/auth/me")).StatusCode);
        await TestAccounts.RegisterAsync(http);
        Assert.Equal(HttpStatusCode.Unauthorized, (await http.GetAsync("/api/auth/me")).StatusCode);
        var bad = await http.PostAsJsonAsync("/api/auth/login", new { email = "captain@example.com", password = "wrong" });
        Assert.Equal(HttpStatusCode.Unauthorized, bad.StatusCode);
        await TestAccounts.LoginAsync(http, "CAPTAIN@example.com");
        var profile = await http.GetFromJsonAsync<Profile>("/api/auth/me");
        Assert.Equal("Captain", profile!.DisplayName);
        using (var scope = accounts.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AuthDbContext>();
            var user = Assert.Single(db.Users);
            Assert.NotEqual(TestAccounts.Password, user.PasswordHash);
            Assert.False(string.IsNullOrWhiteSpace(user.PasswordHash));
        }
        var cookie = (await http.PostAsJsonAsync("/api/auth/login", new { email = "captain@example.com", password = TestAccounts.Password }))
            .Headers.GetValues("Set-Cookie").First().Split(';')[0];
        Assert.Equal(HttpStatusCode.OK, (await http.PostAsJsonAsync("/api/auth/logout", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await http.GetAsync("/api/auth/me")).StatusCode);
        using var replay = new HttpClient(new HttpClientHandler { UseCookies = false }) { BaseAddress = http.BaseAddress };
        replay.DefaultRequestHeaders.Add("Cookie", cookie);
        Assert.Equal(HttpStatusCode.Unauthorized, (await replay.GetAsync("/api/auth/me")).StatusCode);
        await accounts.App.StopAsync();
        await accounts.App.DisposeAsync();
        await accounts.StartAsync();
        using var afterRestart = accounts.Client();
        await TestAccounts.LoginAsync(afterRestart);
    }

    [Fact]
    public async Task RegistrationRejectsDuplicatesAndInvalidInput_AndLoginLocksOut()
    {
        await using var accounts = new TestAccounts();
        await accounts.StartAsync();
        using var http = accounts.Client();
        await TestAccounts.RegisterAsync(http);
        foreach (var payload in new[] {
            new { email = "CAPTAIN@example.com", password = TestAccounts.Password, displayName = "Captain" },
            new { email = "invalid", password = TestAccounts.Password, displayName = "Captain" },
            new { email = "other@example.com", password = "short", displayName = "Captain" },
            new { email = "other@example.com", password = TestAccounts.Password, displayName = "" }
        }) Assert.Equal(HttpStatusCode.BadRequest, (await http.PostAsJsonAsync("/api/auth/register", payload)).StatusCode);
        for (int i = 0; i < 5; i++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await http.PostAsJsonAsync("/api/auth/login", new { email = "captain@example.com", password = "wrong" })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await http.PostAsJsonAsync("/api/auth/login", new { email = "captain@example.com", password = TestAccounts.Password })).StatusCode);
        http.DefaultRequestHeaders.Remove("X-Battleship-Request");
        Assert.Equal(HttpStatusCode.Forbidden, (await http.PostAsJsonAsync("/api/auth/logout", new { })).StatusCode);
    }

    [Fact]
    public async Task ClientProxy_RequiresLoginForWebSocket_AndForwardsAccounts()
    {
        await using var accounts = new TestAccounts();
        await accounts.StartAsync();
        await using var server = await TestServer.StartAsync(tickets: accounts.Tickets, scores: accounts.Scores);
        await using var client = WebHost.Build(new ClientConfig { WebPort = FreePort(), ServerPort = server.Port, AuthPort = accounts.Port });
        await client.StartAsync();
        var cookies = new TestCookieJar();
        using var http = new HttpClient(new TestCookieHandler(cookies)) { BaseAddress = new Uri(client.Urls.First().Replace("localhost", "127.0.0.1")) };
        http.DefaultRequestHeaders.Add("X-Battleship-Request", "1");
        var wsUri = new UriBuilder(http.BaseAddress) { Scheme = "ws", Path = "/ws" }.Uri;
        using (var anonymous = new ClientWebSocket())
            await Assert.ThrowsAsync<WebSocketException>(() => anonymous.ConnectAsync(wsUri, CancellationToken.None));
        await TestAccounts.RegisterAsync(http);
        await TestAccounts.LoginAsync(http);
        Assert.Equal("Captain", (await http.GetFromJsonAsync<Profile>("/api/auth/me"))!.DisplayName);
        using (var authenticated = new ClientWebSocket())
        {
            authenticated.Options.SetRequestHeader("Cookie", cookies.Value);
            await authenticated.ConnectAsync(wsUri, CancellationToken.None);
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            var buffer = new byte[1024];
            var message = await authenticated.ReceiveAsync(buffer, timeout.Token);
            Assert.Contains("connected", System.Text.Encoding.UTF8.GetString(buffer, 0, message.Count));
            await authenticated.CloseAsync(WebSocketCloseStatus.NormalClosure, "test", timeout.Token);
        }
        http.DefaultRequestHeaders.Add("Origin", "https://untrusted.example");
        Assert.Equal(HttpStatusCode.Forbidden, (await http.PostAsJsonAsync("/api/auth/logout", new { })).StatusCode);
        http.DefaultRequestHeaders.Remove("Origin");
        (await http.PostAsJsonAsync("/api/auth/logout", new { })).EnsureSuccessStatusCode();
        using var loggedOut = new ClientWebSocket();
        loggedOut.Options.SetRequestHeader("Cookie", cookies.Value);
        await Assert.ThrowsAsync<WebSocketException>(() => loggedOut.ConnectAsync(wsUri, CancellationToken.None));
    }

    private static int FreePort()
    {
        var listener = new System.Net.Sockets.TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        listener.Stop();
        return port;
    }
    private sealed record Profile(string Id, string Email, string DisplayName);
}

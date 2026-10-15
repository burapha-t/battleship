using System.Net;
using System.Net.Http.Json;
using Battleship.Server.Auth;
using Microsoft.AspNetCore.Builder;

namespace Battleship.IntegrationTests;

internal sealed class TestAccounts : IAsyncDisposable
{
    private readonly string directory = Path.Combine(Path.GetTempPath(), "battleship-auth-" + Guid.NewGuid());
    public WebApplication App { get; private set; } = null!;
    public Action<string>? OnLogout { get; set; }
    public GameTickets Tickets { get; } = new();
    public AccountScores Scores => new(DatabasePath);
    public int Port => new Uri(App.Urls.First()).Port;
    public string DatabasePath => Path.Combine(directory, "accounts.db");
    public const string Password = "Test-Captain42!";

    public async Task StartAsync()
    {
        App = AuthServer.Create("http://127.0.0.1:0", DatabasePath, Tickets, id => OnLogout?.Invoke(id));
        await App.StartAsync();
    }

    public HttpClient Client(TestCookieJar? cookies = null)
    {
        var client = new HttpClient(new TestCookieHandler(cookies ?? new()))
            { BaseAddress = new Uri(App.Urls.First()) };
        client.DefaultRequestHeaders.Add("X-Battleship-Request", "1");
        return client;
    }

    public static async Task RegisterAsync(HttpClient http, string email = "captain@example.com")
    {
        var response = await http.PostAsJsonAsync("/api/auth/register", new { email, password = Password, displayName = "Captain" });
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
    }

    public static async Task LoginAsync(HttpClient http, string email = "captain@example.com")
    {
        var response = await http.PostAsJsonAsync("/api/auth/login", new { email, password = Password });
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
    }

    public async ValueTask DisposeAsync()
    {
        await App.StopAsync();
        await App.DisposeAsync();
        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        Directory.Delete(directory, recursive: true);
    }
}

// Explicit cookie handling also works in restricted macOS runners where domain lookup is unavailable.
internal sealed class TestCookieJar { public string Value { get; set; } = ""; }
internal sealed class TestCookieHandler(TestCookieJar jar) : DelegatingHandler(new HttpClientHandler { UseCookies = false, AllowAutoRedirect = false })
{
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        if (jar.Value.Length > 0) request.Headers.TryAddWithoutValidation("Cookie", jar.Value);
        var response = await base.SendAsync(request, cancellationToken);
        if (response.Headers.TryGetValues("Set-Cookie", out var values))
            jar.Value = values.First().Split(';')[0];
        return response;
    }
}

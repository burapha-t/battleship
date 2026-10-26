using System.Net;
using Battleship.Core;
using Battleship.Core.Protocol;
using Battleship.Server.Accounts;
using Battleship.Server.Dashboard;
using Battleship.Server.Data;
using Battleship.Server.Host;
using Battleship.Server.Net;
using Microsoft.AspNetCore.Builder;

namespace Battleship.IntegrationTests;

/// <summary>
/// The real server in-process: the game loop, TCP on a free loopback port and
/// the dashboard on another, so tests never trigger a firewall prompt.
/// </summary>
public sealed class TestServer : IAsyncDisposable
{
    /// <summary>PBKDF2 iterations for test accounts: low, so a login takes no time.</summary>
    public const int HashIterations = 1_000;

    private readonly CancellationTokenSource _stop;
    private readonly Task _running;
    private readonly WebApplication _dashboard;

    private TestServer(GameHost host, int port, WebApplication dashboard, CancellationTokenSource stop, Task running)
    {
        Host = host;
        Port = port;
        _dashboard = dashboard;
        _stop = stop;
        _running = running;
        Dashboard = new HttpClient { BaseAddress = new Uri(dashboard.Urls.First()) };
    }

    public GameHost Host { get; }

    /// <summary>The game's TCP port.</summary>
    public int Port { get; }

    /// <summary>An HTTP client for the dashboard (<c>/</c>, <c>/api/state</c>, <c>/api/reset</c>).</summary>
    public HttpClient Dashboard { get; }

    /// <param name="turnDuration">
    /// How long the server's turn timer really waits; defaults to 10 s. The
    /// wire still says <c>seconds: 10</c>.
    /// </param>
    /// <param name="database">Accounts and saved matches; none by default, so everyone is a guest.</param>
    /// <param name="hashIterations">The password hash cost; <see cref="HashIterations"/> by default.</param>
    public static async Task<TestServer> StartAsync(
        TimeSpan? turnDuration = null, Random? random = null, GameDatabase? database = null, int hashIterations = HashIterations)
    {
        var host = new GameHost(
            turnDuration ?? TimeSpan.FromSeconds(GameRules.TurnSeconds), random ?? new Random(), database,
            new PasswordHasher(hashIterations));
        var acceptLoop = new TcpAcceptLoop(new IPEndPoint(IPAddress.Loopback, 0), host);
        int port = acceptLoop.Start();
        var dashboard = DashboardServer.Create(host, "http://127.0.0.1:0", port);
        await dashboard.StartAsync();

        var stop = new CancellationTokenSource();
        var running = Task.WhenAll(host.RunAsync(stop.Token), acceptLoop.RunAsync(stop.Token));
        return new TestServer(host, port, dashboard, stop, running);
    }

    public Task<TestClient> ConnectAsync() => TestClient.ConnectAsync(Port);

    /// <summary>Connects and joins; <c>welcome</c> has been read, the <c>lobby</c> after it hasn't.</summary>
    public Task<TestClient> JoinAsync(string nickname) => WelcomedAsync(new Join { Nickname = nickname });

    /// <summary>Connects and signs up; <c>welcome</c> has been read, the <c>lobby</c> after it hasn't.</summary>
    public Task<TestClient> SignUpAsync(string username, string password) =>
        WelcomedAsync(new Signup { Username = username, Password = password });

    /// <summary>Connects and logs in; <c>welcome</c> has been read, the <c>lobby</c> after it hasn't.</summary>
    public Task<TestClient> LogInAsync(string username, string password) =>
        WelcomedAsync(new Login { Username = username, Password = password });

    private async Task<TestClient> WelcomedAsync(ProtocolMessage first)
    {
        var client = await ConnectAsync();
        await client.SendAsync(first);
        var welcome = await client.NextAsync<Welcome>();
        client.Name = welcome.Nickname;
        return client;
    }

    /// <summary>Polls the dashboard snapshot until <paramref name="condition"/> holds.</summary>
    public async Task WaitUntilAsync(Func<DashboardSnapshot, bool> condition)
    {
        var deadline = DateTime.UtcNow + TestClient.DefaultTimeout;
        while (!condition(Host.Snapshot))
        {
            if (DateTime.UtcNow > deadline) Assert.Fail("The server never reached the expected state.");
            await Task.Delay(10);
        }
    }

    public async ValueTask DisposeAsync()
    {
        _stop.Cancel();
        await _running;
        await _dashboard.DisposeAsync();
        Dashboard.Dispose();
        _stop.Dispose();
    }
}

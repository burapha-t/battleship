using System.Net;
using Battleship.Core;
using Battleship.Server.Dashboard;
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
    public static async Task<TestServer> StartAsync(TimeSpan? turnDuration = null, Random? random = null)
    {
        var host = new GameHost(turnDuration ?? TimeSpan.FromSeconds(GameRules.TurnSeconds), random ?? new Random());
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
    public async Task<TestClient> JoinAsync(string nickname)
    {
        var client = await ConnectAsync();
        await client.SendAsync(new Core.Protocol.Join { Nickname = nickname });
        var welcome = await client.NextAsync<Core.Protocol.Welcome>();
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

using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using Battleship.Server.Host;

namespace Battleship.Server.Net;

/// <summary>
/// Accepts player connections and gives each a <see cref="ClientSession"/>
/// with the next id: p1, p2, …, never reused.
/// </summary>
public sealed class TcpAcceptLoop
{
    private readonly TcpListener _listener;
    private readonly GameHost _host;
    private readonly ConcurrentDictionary<string, ClientSession> _sessions = new();
    private int _sessionCount;

    /// <param name="endpoint"><c>IPAddress.Any:5050</c> in the real server; tests use loopback and port 0.</param>
    public TcpAcceptLoop(IPEndPoint endpoint, GameHost host)
    {
        _listener = new TcpListener(endpoint);
        _host = host;
    }

    /// <summary>Binds the port and returns the one actually bound.</summary>
    public int Start()
    {
        _listener.Start();
        return ((IPEndPoint)_listener.LocalEndpoint).Port;
    }

    /// <summary>Accepts until cancelled, then closes every open session.</summary>
    public async Task RunAsync(CancellationToken cancellationToken)
    {
        try
        {
            while (!cancellationToken.IsCancellationRequested)
            {
                TcpClient tcp;
                try
                {
                    tcp = await _listener.AcceptTcpClientAsync(cancellationToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (SocketException ex)
                {
                    Console.WriteLine($"Accept failed: {ex.Message}");
                    continue;
                }

                tcp.NoDelay = true;
                var session = new ClientSession($"p{++_sessionCount}", tcp, _host);
                _sessions[session.Id] = session;
                _ = RunSessionAsync(session);
            }
        }
        finally
        {
            _listener.Stop();
            foreach (var session in _sessions.Values) session.Close();
        }
    }

    private async Task RunSessionAsync(ClientSession session)
    {
        try
        {
            await session.RunAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[{session.Id}] session failed: {ex}");
        }
        finally
        {
            _sessions.TryRemove(session.Id, out _);
        }
    }
}

using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading.Channels;
using Battleship.Core.Protocol;
using Battleship.Server.Host;

namespace Battleship.Server.Net;

/// <summary>
/// One player's socket. A read loop turns each line into a
/// <see cref="HostInput.Message"/>; an outgoing queue is drained by one writer,
/// so frames never interleave. It holds no game state.
/// </summary>
public sealed class ClientSession
{
    private readonly TcpClient _tcp;
    private readonly GameHost _host;
    private readonly Channel<string> _outgoing =
        Channel.CreateUnbounded<string>(new UnboundedChannelOptions { SingleReader = true });
    private int _closed;

    public ClientSession(string id, TcpClient tcp, GameHost host)
    {
        Id = id;
        _tcp = tcp;
        _host = host;
        Address = (tcp.Client.RemoteEndPoint as IPEndPoint)?.Address.ToString() ?? "unknown";
    }

    public string Id { get; }

    public string Address { get; }

    /// <summary>Queues one frame, without its <c>\n</c>. Safe from any thread; dropped after close.</summary>
    public void Send(string line) => _outgoing.Writer.TryWrite(line);

    /// <summary>
    /// Posts <see cref="HostInput.Connected"/>, relays lines until the socket
    /// closes, then posts <see cref="HostInput.Disconnected"/>.
    /// </summary>
    public async Task RunAsync()
    {
        _host.Post(new HostInput.Connected(this));
        var writing = WriteLoopAsync();
        try
        {
            await ReadLoopAsync();
        }
        catch (Exception ex)
        {
            if (Volatile.Read(ref _closed) == 0) Console.WriteLine($"[{Id}] read failed: {ex.Message}");
        }
        finally
        {
            Close();
        }
        await writing;
    }

    /// <summary>Closes the socket and posts <see cref="HostInput.Disconnected"/>, once.</summary>
    public void Close()
    {
        if (Interlocked.Exchange(ref _closed, 1) == 1) return;
        _outgoing.Writer.TryComplete();
        _tcp.Close();
        _host.Post(new HostInput.Disconnected(Id));
    }

    private async Task ReadLoopAsync()
    {
        // ReadLineAsync buffers split and merged TCP reads (protocol.md §1 rule 4).
        using var reader = new StreamReader(_tcp.GetStream(), Encoding.UTF8);
        while (await reader.ReadLineAsync() is { } line)
        {
            var message = ProtocolJson.Parse(line);
            if (message != null)
                _host.Post(new HostInput.Message(Id, message));
            else if (line.Length > 0)
                Console.WriteLine($"[{Id}] skipped a line that isn't a known message: {Shorten(line)}");
        }
    }

    private async Task WriteLoopAsync()
    {
        try
        {
            var stream = _tcp.GetStream();
            await foreach (var line in _outgoing.Reader.ReadAllAsync())
            {
                // Encoding.GetBytes writes no BOM, and the frame ends in \n, never \r\n.
                await stream.WriteAsync(Encoding.UTF8.GetBytes(line + "\n"));
            }
        }
        catch (Exception ex)
        {
            if (Volatile.Read(ref _closed) == 0) Console.WriteLine($"[{Id}] write failed: {ex.Message}");
        }
        finally
        {
            Close();
        }
    }

    private static string Shorten(string line) => line.Length <= 80 ? line : line[..80] + "…";
}

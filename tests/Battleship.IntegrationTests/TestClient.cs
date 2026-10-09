using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading.Channels;
using Battleship.Core.Protocol;

namespace Battleship.IntegrationTests;

/// <summary>
/// A headless player on a raw TCP socket. It splits the stream on <c>\n</c>
/// itself, so a <c>\r</c> or a BOM on the wire fails the test.
/// </summary>
public sealed class TestClient : IAsyncDisposable
{
    public static readonly TimeSpan DefaultTimeout = TimeSpan.FromSeconds(5);

    private readonly TcpClient _tcp;
    private readonly NetworkStream _stream;
    private readonly Channel<string> _lines = Channel.CreateUnbounded<string>();
    private readonly List<string> _received = new();
    private readonly Task _reading;

    private TestClient(TcpClient tcp)
    {
        _tcp = tcp;
        _stream = tcp.GetStream();
        _reading = ReadLoopAsync();
    }

    /// <summary>The id from <c>connected</c>.</summary>
    public string Id { get; private set; } = "";

    /// <summary>The nickname from <c>welcome</c>, once joined.</summary>
    public string? Name { get; set; }

    /// <summary>Every frame received so far, raw, in order.</summary>
    public IReadOnlyList<string> Received
    {
        get { lock (_received) return _received.ToList(); }
    }

    /// <summary>Connects and reads <c>connected</c>.</summary>
    public static async Task<TestClient> ConnectAsync(int port)
    {
        var tcp = new TcpClient { NoDelay = true };
        await tcp.ConnectAsync(IPAddress.Loopback, port);
        var client = new TestClient(tcp);
        client.Id = (await client.NextAsync<Connected>()).Id;
        return client;
    }

    public Task SendAsync(ProtocolMessage message) => SendRawAsync(ProtocolJson.Serialize(message));

    public Task SendRawAsync(string line) => WriteRawAsync(line + "\n");

    /// <summary>Writes exactly <paramref name="text"/>, with no <c>\n</c> added.</summary>
    public async Task WriteRawAsync(string text) => await _stream.WriteAsync(Encoding.UTF8.GetBytes(text));

    /// <summary>The next frame, raw.</summary>
    public async Task<string> NextRawAsync(TimeSpan? timeout = null)
    {
        using var cancel = new CancellationTokenSource(timeout ?? DefaultTimeout);
        try
        {
            if (await _lines.Reader.WaitToReadAsync(cancel.Token) && _lines.Reader.TryRead(out var line))
            {
                AssertCleanFrame(line);
                return line;
            }
        }
        catch (OperationCanceledException)
        {
            Assert.Fail($"{Id}: no frame within {(timeout ?? DefaultTimeout).TotalSeconds} s.");
        }
        Assert.Fail($"{Id}: the server closed the connection.");
        return "";
    }

    /// <summary>The next frame, which must be a <typeparamref name="T"/>.</summary>
    public async Task<T> NextAsync<T>(TimeSpan? timeout = null) where T : ProtocolMessage
    {
        string line = await NextRawAsync(timeout);
        return Assert.IsType<T>(ProtocolJson.Parse(line));
    }

    /// <summary>Skips frames until a <typeparamref name="T"/> matching <paramref name="match"/> arrives.</summary>
    public async Task<T> WaitForAsync<T>(Func<T, bool>? match = null, TimeSpan? timeout = null) where T : ProtocolMessage
    {
        var deadline = DateTime.UtcNow + (timeout ?? DefaultTimeout);
        while (true)
        {
            var left = deadline - DateTime.UtcNow;
            if (left <= TimeSpan.Zero) Assert.Fail($"{Id}: no matching {typeof(T).Name} in time.");
            if (ProtocolJson.Parse(await NextRawAsync(left)) is T message && (match == null || match(message)))
                return message;
        }
    }

    /// <summary>Fails if any frame arrives within <paramref name="quiet"/>.</summary>
    public async Task AssertNothingAsync(TimeSpan quiet)
    {
        using var cancel = new CancellationTokenSource(quiet);
        try
        {
            if (await _lines.Reader.WaitToReadAsync(cancel.Token) && _lines.Reader.TryRead(out var line))
                Assert.Fail($"{Id}: expected nothing, got {line}");
        }
        catch (OperationCanceledException)
        {
            // Quiet, as expected.
        }
    }

    public async ValueTask DisposeAsync()
    {
        _tcp.Close();
        await _reading;
    }

    private async Task ReadLoopAsync()
    {
        var buffer = new byte[8192];
        var line = new List<byte>();
        try
        {
            int read;
            while ((read = await _stream.ReadAsync(buffer)) > 0)
            {
                for (int i = 0; i < read; i++)
                {
                    if (buffer[i] != (byte)'\n')
                    {
                        line.Add(buffer[i]);
                        continue;
                    }
                    string text = Encoding.UTF8.GetString(line.ToArray());
                    line.Clear();
                    lock (_received) _received.Add(text);
                    _lines.Writer.TryWrite(text);
                }
            }
        }
        catch (Exception ex) when (ex is IOException or ObjectDisposedException or SocketException)
        {
            // We closed it, or the server did.
        }
        _lines.Writer.TryComplete();
    }

    // protocol.md §1: LF not CRLF, UTF-8 without a BOM.
    private void AssertCleanFrame(string line)
    {
        Assert.False(line.Contains('\r'), $"{Id}: frame contains \\r: {line}");
        Assert.False(line.StartsWith('﻿'), $"{Id}: frame starts with a BOM: {line}");
    }
}

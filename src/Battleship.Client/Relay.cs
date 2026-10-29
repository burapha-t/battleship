using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using System.ComponentModel;
using System.Net.WebSockets;

namespace Battleship.Client;

/// <summary>
/// Joins one browser WebSocket to its own TCP connection to the server and
/// passes ordinary frames unchanged (zero game rules). The local playGhost
/// command starts a Python opponent and sends a private findMatch. One
/// WebSocket text message is one frame without <c>\n</c>; on TCP each frame
/// ends in <c>\n</c>. When either side closes, the other is closed too.
/// </summary>
public static class Relay
{
    private const int BufferSize = 8192;

    public static async Task RunAsync(WebSocket browser, ClientConfig config, CancellationToken aborted)
    {
        string server = $"{config.ServerHost}:{config.ServerPort}";
        using var tcp = new TcpClient { NoDelay = true };
        try
        {
            await tcp.ConnectAsync(config.ServerHost, config.ServerPort, aborted);
        }
        catch (Exception ex) when (ex is SocketException or OperationCanceledException)
        {
            Console.WriteLine($"Cannot reach the server at {server}: {ex.Message}");
            await CloseBrowserAsync(browser, "Server unreachable");
            return;
        }

        Console.WriteLine($"Browser connected; relaying to {server}.");
        var stream = tcp.GetStream();
        using var stop = CancellationTokenSource.CreateLinkedTokenSource(aborted);
        using var state = new BridgeState(browser, tcp.Close);
        var toServer = BrowserToServerAsync(browser, stream, config, state, stop.Token);
        var toBrowser = ServerToBrowserAsync(stream, state, stop.Token);

        var first = await Task.WhenAny(toServer, toBrowser);
        string reason = first == toServer ? "the browser closed" : "the server closed";
        if (first.IsFaulted) reason += $" ({first.Exception!.GetBaseException().Message})";

        // Closing the socket ends the server-side loop and tells the server
        // this player left; then the browser gets a close frame.
        tcp.Close();
        await Quietly(toBrowser);
        await CloseBrowserAsync(browser, "Server connection closed");
        stop.CancelAfter(TimeSpan.FromSeconds(5));
        await Quietly(toServer);
        Console.WriteLine($"Disconnected: {reason}.");
    }

    // Splits the server's byte stream on \n; each line becomes one text message.
    private static async Task ServerToBrowserAsync(NetworkStream server, BridgeState state, CancellationToken cancellationToken)
    {
        var buffer = new byte[BufferSize];
        var line = new MemoryStream();
        while (true)
        {
            int read = await server.ReadAsync(buffer, cancellationToken);
            if (read == 0) return;

            int start = 0;
            for (int i = 0; i < read; i++)
            {
                if (buffer[i] != (byte)'\n') continue;
                line.Write(buffer, start, i - start);
                start = i + 1;
                if (line.Length == 0) continue;
                var frame = line.ToArray();
                state.Observe(frame);
                await state.SendAsync(frame, cancellationToken);
                // The human never reached a match, so nothing will end the bot's
                // session: stop it and put the browser back in ordinary mode.
                if (MessageType(frame) == "error" && state.Ghost != null && state.Status is not ("placing" or "in-match"))
                {
                    state.StopGhost();
                    await state.SendAsync(GhostMode(false), cancellationToken);
                }
                line.SetLength(0);
            }
            line.Write(buffer, start, read - start);
        }
    }

    // Collects a message's fragments, then writes it to the server with \n.
    private static async Task BrowserToServerAsync(WebSocket browser, NetworkStream server, ClientConfig config, BridgeState state, CancellationToken cancellationToken)
    {
        var buffer = new byte[BufferSize];
        var message = new MemoryStream();
        while (true)
        {
            var result = await browser.ReceiveAsync(new ArraySegment<byte>(buffer), cancellationToken);
            if (result.MessageType == WebSocketMessageType.Close) return;

            message.Write(buffer, 0, result.Count);
            if (!result.EndOfMessage) continue;

            var type = MessageType(message.ToArray());
            if (type == "playGhost")
            {
                message.SetLength(0);
                if (state.Status != "idle" || state.Ghost != null)
                {
                    // Every playGhost gets an answer, so the browser never waits on a refused click.
                    await state.SendAsync(GhostMode(state.Ghost != null), cancellationToken);
                    continue;
                }
                var ghost = new GhostProcess(state.UnexpectedExit);
                state.Ghost = ghost;
                var key = Guid.NewGuid().ToString("N");
                try
                {
                    await ghost.StartAsync(config, key, cancellationToken);
                    await state.SendAsync(GhostMode(true), cancellationToken);
                    var command = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new { type = "findMatch", matchKey = key }) + "\n");
                    await server.WriteAsync(command, cancellationToken);
                }
                catch (Exception ex) when (ex is IOException or Win32Exception or OperationCanceledException or InvalidOperationException)
                {
                    ghost.Dispose();
                    state.Ghost = null;
                    await state.SendAsync(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new
                    {
                        type = "error", code = "unknown",
                        message = "Ghost Fleet could not start. Install Python 3.9 or newer on the client computer and try again."
                    })), cancellationToken);
                }
                continue;
            }
            if (type == "quitGhost")
            {
                message.SetLength(0);
                // Killing the managed opponent closes its TCP session. The
                // server then ends the unfinished match and returns the human
                // to idle through the normal opponentLeft + lobby events.
                state.StopGhost();
                continue;
            }
            if (type == "leave") state.StopGhost();
            message.WriteByte((byte)'\n');
            await server.WriteAsync(message.GetBuffer().AsMemory(0, (int)message.Length), cancellationToken);
            message.SetLength(0);
        }
    }

    private static byte[] GhostMode(bool active) =>
        Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new { type = "ghostMode", active }));

    private static string? MessageType(byte[] frame)
    {
        try
        {
            using var json = JsonDocument.Parse(frame);
            return json.RootElement.ValueKind == JsonValueKind.Object && json.RootElement.TryGetProperty("type", out var type)
                && type.ValueKind == JsonValueKind.String ? type.GetString() : null;
        }
        catch (JsonException) { return null; }
    }

    private sealed class BridgeState(WebSocket browser, Action unexpectedExit) : IDisposable
    {
        private readonly SemaphoreSlim _send = new(1);
        private string? _id;
        public string? Status { get; private set; }
        public GhostProcess? Ghost { get; set; }
        public Action UnexpectedExit => unexpectedExit;

        public async Task SendAsync(byte[] frame, CancellationToken cancel)
        {
            await _send.WaitAsync(cancel);
            try { await browser.SendAsync(frame, WebSocketMessageType.Text, true, cancel); }
            finally { _send.Release(); }
        }

        public void Observe(byte[] frame)
        {
            try
            {
                using var json = JsonDocument.Parse(frame);
                var root = json.RootElement;
                switch (MessageType(frame))
                {
                    case "connected": _id = root.GetProperty("id").GetString(); break;
                    case "welcome": Status = "idle"; break;
                    case "matchStart": Status = "placing"; break;
                    case "turn": Status = "in-match"; break;
                    case "lobby":
                        foreach (var client in root.GetProperty("clients").EnumerateArray())
                            if (client.GetProperty("id").GetString() == _id)
                                Status = client.GetProperty("status").GetString();
                        break;
                    case "reset":
                    case "opponentLeft":
                        StopGhost();
                        Status = "idle";
                        break;
                }
            }
            catch (Exception ex) when (ex is JsonException or KeyNotFoundException or InvalidOperationException) { }
        }

        public void StopGhost()
        {
            var ghost = Ghost;
            Ghost = null;
            ghost?.Dispose();
        }

        public void Dispose() { StopGhost(); _send.Dispose(); }
    }

    private static async Task CloseBrowserAsync(WebSocket browser, string reason)
    {
        if (browser.State is not (WebSocketState.Open or WebSocketState.CloseReceived)) return;
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        try
        {
            await browser.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, reason, timeout.Token);
        }
        catch (Exception ex) when (ex is WebSocketException or OperationCanceledException or IOException)
        {
            // The browser is already gone.
        }
    }

    // The side that didn't finish first fails once we close its socket: expected.
    private static async Task Quietly(Task task)
    {
        try
        {
            await task;
        }
        catch (Exception ex) when (ex is IOException or SocketException or ObjectDisposedException
                                       or WebSocketException or OperationCanceledException)
        {
        }
    }
}

using System.Net.Sockets;
using System.Net.WebSockets;

namespace Battleship.Client;

/// <summary>
/// Joins one browser WebSocket to its own TCP connection to the server and
/// passes bytes both ways without reading them (zero game logic). One
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
        var toServer = BrowserToServerAsync(browser, stream, stop.Token);
        var toBrowser = ServerToBrowserAsync(stream, browser, stop.Token);

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
    private static async Task ServerToBrowserAsync(NetworkStream server, WebSocket browser, CancellationToken cancellationToken)
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
                await browser.SendAsync(new ArraySegment<byte>(line.GetBuffer(), 0, (int)line.Length),
                    WebSocketMessageType.Text, endOfMessage: true, cancellationToken);
                line.SetLength(0);
            }
            line.Write(buffer, start, read - start);
        }
    }

    // Collects a message's fragments, then writes it to the server with \n.
    private static async Task BrowserToServerAsync(WebSocket browser, NetworkStream server, CancellationToken cancellationToken)
    {
        var buffer = new byte[BufferSize];
        var message = new MemoryStream();
        while (true)
        {
            var result = await browser.ReceiveAsync(new ArraySegment<byte>(buffer), cancellationToken);
            if (result.MessageType == WebSocketMessageType.Close) return;

            message.Write(buffer, 0, result.Count);
            if (!result.EndOfMessage) continue;

            message.WriteByte((byte)'\n');
            await server.WriteAsync(message.GetBuffer().AsMemory(0, (int)message.Length), cancellationToken);
            message.SetLength(0);
        }
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

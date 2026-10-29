using System.Diagnostics;

namespace Battleship.Client;

/// <summary>One Python opponent owned by one browser connection.</summary>
internal sealed class GhostProcess : IDisposable
{
    private Process? _process;
    private bool _stopping;
    private readonly Action _unexpectedExit;

    public GhostProcess(Action unexpectedExit) => _unexpectedExit = unexpectedExit;

    public async Task StartAsync(ClientConfig config, string key, CancellationToken cancel)
    {
        var folder = AppContext.BaseDirectory;
        if (!File.Exists(Path.Combine(folder, "bot", "main.py")))
            throw new IOException("Ghost Fleet files are missing.");
        var info = new ProcessStartInfo
        {
            FileName = config.PythonExecutable ?? Environment.GetEnvironmentVariable("BATTLESHIP_PYTHON")
                ?? (OperatingSystem.IsWindows() ? "python" : "python3"),
            WorkingDirectory = folder,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
        };
        foreach (var arg in new[] { "-m", "bot.main", "--server", config.ServerHost,
                     "--port", config.ServerPort.ToString(), "--match-key", key })
            info.ArgumentList.Add(arg);
        var process = Process.Start(info) ?? throw new IOException("Could not start Ghost Fleet.");
        _process = process;
        // Forward mode and failure diagnostics; the bot never writes wire frames to stderr.
        process.ErrorDataReceived += (_, args) =>
        {
            if (!string.IsNullOrWhiteSpace(args.Data)) Console.Error.WriteLine(args.Data);
        };
        process.BeginErrorReadLine();
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancel);
        timeout.CancelAfter(TimeSpan.FromSeconds(8));
        if (await process.StandardOutput.ReadLineAsync(timeout.Token) != "GHOST_READY")
            throw new IOException("Ghost Fleet did not join the server.");
        _ = WatchExitAsync(process);
    }

    private async Task WatchExitAsync(Process process)
    {
        try
        {
            await process.WaitForExitAsync();
            if (!_stopping && process.ExitCode != 0) _unexpectedExit();
        }
        catch (InvalidOperationException) { } // Disposed during connection shutdown.
    }

    public void Dispose()
    {
        _stopping = true;
        if (_process is not { } process) return;
        _process = null;
        try
        {
            if (!process.HasExited) process.Kill(entireProcessTree: true);
        }
        catch (InvalidOperationException) { }
        finally { process.Dispose(); }
    }
}

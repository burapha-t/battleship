using System.Diagnostics;

namespace Battleship.Client;

/// <summary>
/// Starts/stops the local Python AI helper and Ghost Fleet process.
/// This is intentionally outside the game server: Ghost still joins through
/// the frozen TCP protocol like a normal player.
/// </summary>
public static class AiProcessManager
{
    private static readonly object Gate = new();
    private static Process? _helper;
    private static Process? _ghost;
    private static string? _ghostOf;

    public sealed record GhostStatus(bool Running, string? GhostOf, string Message);

    public static void TryStartHelper()
    {
        lock (Gate)
        {
            if (IsRunning(_helper)) return;

            string? botDir = FindBotDirectory();
            if (botDir is null)
            {
                Console.WriteLine("[AI] bot/ was not found. Sonar and one-click Ghost are unavailable.");
                return;
            }

            string script = Path.Combine(botDir, "ai_service.py");
            try
            {
                _helper = StartPython(botDir, script);
                Console.WriteLine("[AI] local Sonar/history helper started.");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AI] helper not started ({ex.Message}). Base game still works.");
            }
        }
    }

    public static GhostStatus StartGhost(ClientConfig config, string ghostOf)
    {
        ghostOf = (ghostOf ?? string.Empty).Trim();
        if (ghostOf.Length == 0)
            return new GhostStatus(false, null, "Enter a nickname before starting Ghost Fleet.");

        lock (Gate)
        {
            if (IsRunning(_ghost))
            {
                if (string.Equals(_ghostOf, ghostOf, StringComparison.OrdinalIgnoreCase))
                    return new GhostStatus(true, _ghostOf, $"Ghost of {_ghostOf} is already running.");

                StopProcess(_ghost);
                _ghost = null;
                _ghostOf = null;
            }

            string? botDir = FindBotDirectory();
            if (botDir is null)
                return new GhostStatus(false, null, "bot/ was not found. Run the client from the repository or set BATTLESHIP_BOT_DIR.");

            string script = Path.Combine(botDir, "main.py");

            try
            {
                _ghost = StartPython(
                    botDir,
                    script,
                    "--server", config.ServerHost,
                    "--port", config.ServerPort.ToString(),
                    "--ghost-of", ghostOf
                );
                _ghostOf = ghostOf;
                Console.WriteLine($"[AI] Ghost of {ghostOf} started and is connecting to {config.ServerHost}:{config.ServerPort}.");
                return new GhostStatus(true, ghostOf, $"Ghost of {ghostOf} is joining the lobby.");
            }
            catch (Exception ex)
            {
                _ghost = null;
                _ghostOf = null;
                return new GhostStatus(false, null, $"Could not start Ghost Fleet: {ex.Message}");
            }
        }
    }

    public static GhostStatus GetGhostStatus()
    {
        lock (Gate)
        {
            bool running = IsRunning(_ghost);
            if (!running)
            {
                _ghost = null;
                _ghostOf = null;
            }

            return new GhostStatus(
                running,
                _ghostOf,
                running ? $"Ghost of {_ghostOf} is running." : "Ghost Fleet is not running."
            );
        }
    }

    public static GhostStatus StopGhost()
    {
        lock (Gate)
        {
            string? oldName = _ghostOf;
            StopProcess(_ghost);
            _ghost = null;
            _ghostOf = null;
            return new GhostStatus(false, null, oldName is null ? "Ghost Fleet was not running." : $"Ghost of {oldName} stopped.");
        }
    }

    public static void StopAll()
    {
        lock (Gate)
        {
            StopProcess(_ghost);
            StopProcess(_helper);
            _ghost = null;
            _helper = null;
            _ghostOf = null;
        }
    }

    private static Process StartPython(string botDir, string script, params string[] args)
    {
        string python = FindPython(botDir);
        var info = new ProcessStartInfo
        {
            FileName = python,
            WorkingDirectory = botDir,
            UseShellExecute = false,
            CreateNoWindow = true,
        };

        info.ArgumentList.Add(script);
        foreach (string arg in args) info.ArgumentList.Add(arg);

        return Process.Start(info) ?? throw new InvalidOperationException("Python process did not start.");
    }

    private static string FindPython(string botDir)
    {
        string[] localCandidates = OperatingSystem.IsWindows()
            ? new[] { Path.Combine(botDir, ".venv", "Scripts", "python.exe") }
            : new[] { Path.Combine(botDir, ".venv", "bin", "python3"), Path.Combine(botDir, ".venv", "bin", "python") };

        foreach (string candidate in localCandidates)
            if (File.Exists(candidate)) return candidate;

        return OperatingSystem.IsWindows() ? "python" : "python3";
    }

    private static string? FindBotDirectory()
    {
        string? configured = Environment.GetEnvironmentVariable("BATTLESHIP_BOT_DIR");
        if (!string.IsNullOrWhiteSpace(configured) &&
            File.Exists(Path.Combine(configured, "main.py")))
            return Path.GetFullPath(configured);

        foreach (string start in new[] { Directory.GetCurrentDirectory(), AppContext.BaseDirectory })
        {
            var dir = new DirectoryInfo(start);
            for (int i = 0; i < 8 && dir is not null; i++, dir = dir.Parent)
            {
                string candidate = Path.Combine(dir.FullName, "bot");
                if (File.Exists(Path.Combine(candidate, "main.py")) &&
                    File.Exists(Path.Combine(candidate, "ai_service.py")))
                    return candidate;
            }
        }

        return null;
    }

    private static bool IsRunning(Process? process)
    {
        try { return process is not null && !process.HasExited; }
        catch { return false; }
    }

    private static void StopProcess(Process? process)
    {
        if (!IsRunning(process)) return;
        try
        {
            process!.Kill(entireProcessTree: true);
            process.WaitForExit(1500);
        }
        catch
        {
            // Best effort only; the OS will clean up child processes on exit.
        }
        finally
        {
            process?.Dispose();
        }
    }
}

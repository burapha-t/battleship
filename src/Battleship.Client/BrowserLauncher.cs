using System.Diagnostics;

namespace Battleship.Client;

/// <summary>Opens the player's default browser at the UI, so nobody types a URL or port.</summary>
public static class BrowserLauncher
{
    public static void Open(string url)
    {
        try
        {
            var start = OperatingSystem.IsWindows() ? new ProcessStartInfo(url) { UseShellExecute = true }
                : OperatingSystem.IsMacOS() ? new ProcessStartInfo("open", url)
                : new ProcessStartInfo("xdg-open", url);
            Process.Start(start)?.Dispose();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Could not open a browser ({ex.Message}). Open {url} yourself.");
        }
    }
}

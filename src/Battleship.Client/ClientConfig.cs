using System.Text.Json;

namespace Battleship.Client;

/// <summary>
/// Where the game server is and which local port serves the UI.
/// Values come from client.json and can be overridden by command-line flags.
/// </summary>
public sealed class ClientConfig
{
    public string ServerHost { get; set; } = "127.0.0.1";
    public int ServerPort { get; set; } = 5050;
    public int WebPort { get; set; } = 3000;

    /// <summary>
    /// Reads client.json, then applies:
    /// --server-host &lt;ip-or-hostname&gt;
    /// --server-port &lt;n&gt;
    /// --web-port &lt;n&gt;
    /// </summary>
    public static ClientConfig Load(string[] args)
    {
        var config = new ClientConfig();
        string path = Path.Combine(AppContext.BaseDirectory, "client.json");
        try
        {
            config = JsonSerializer.Deserialize<ClientConfig>(
                         File.ReadAllText(path),
                         new JsonSerializerOptions(JsonSerializerDefaults.Web))
                     ?? throw new JsonException("the file is empty");
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException)
        {
            Console.WriteLine($"Could not read {path} ({ex.Message}). Using the defaults.");
        }

        ApplyStringFlag(args, "--server-host", value => config.ServerHost = value);
        ApplyIntFlag(args, "--server-port", value => config.ServerPort = value);
        ApplyIntFlag(args, "--web-port", value => config.WebPort = value);

        return config;
    }

    private static void ApplyStringFlag(string[] args, string flag, Action<string> apply)
    {
        int index = Array.IndexOf(args, flag);
        if (index < 0) return;
        if (index + 1 < args.Length && !string.IsNullOrWhiteSpace(args[index + 1]))
            apply(args[index + 1]);
        else
            Console.WriteLine($"{flag} needs a value. Ignoring it.");
    }

    private static void ApplyIntFlag(string[] args, string flag, Action<int> apply)
    {
        int index = Array.IndexOf(args, flag);
        if (index < 0) return;
        if (index + 1 < args.Length && int.TryParse(args[index + 1], out int value))
            apply(value);
        else
            Console.WriteLine($"{flag} needs a number. Ignoring it.");
    }
}

using System.Text.Json;

namespace Battleship.Client;

/// <summary>
/// Where the server is and which local port serves the UI, from
/// <c>client.json</c> beside the program. The player is never asked.
/// </summary>
public sealed class ClientConfig
{
    public string ServerHost { get; set; } = "127.0.0.1";
    public int ServerPort { get; set; } = 5050;
    public int WebPort { get; set; } = 3000;

    /// <summary>
    /// Reads <c>client.json</c> from the program's folder, then applies
    /// <c>--web-port &lt;n&gt;</c>. A missing or broken file prints why and
    /// falls back to the defaults.
    /// </summary>
    public static ClientConfig Load(string[] args)
    {
        var config = new ClientConfig();
        string path = Path.Combine(AppContext.BaseDirectory, "client.json");
        try
        {
            config = JsonSerializer.Deserialize<ClientConfig>(File.ReadAllText(path), new JsonSerializerOptions(JsonSerializerDefaults.Web))
                     ?? throw new JsonException("the file is empty");
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException)
        {
            Console.WriteLine($"Could not read {path} ({ex.Message}). Using the defaults.");
        }

        int flag = Array.IndexOf(args, "--web-port");
        if (flag >= 0)
        {
            if (flag + 1 < args.Length && int.TryParse(args[flag + 1], out int webPort))
                config.WebPort = webPort;
            else
                Console.WriteLine("--web-port needs a number, e.g. --web-port 3001. Ignoring it.");
        }

        return config;
    }
}

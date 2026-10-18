using System.Text;
using Battleship.Client;
using Microsoft.Extensions.Hosting;

// Usage: Battleship.Client [--web-port <n>] [--no-browser] [--lan]
Console.OutputEncoding = Encoding.UTF8;
var config = ClientConfig.Load(args);
string url = $"http://localhost:{config.WebPort}";

Console.WriteLine("Battleship client");
Console.WriteLine($"  Server: {config.ServerHost}:{config.ServerPort} (from client.json)");
Console.WriteLine($"  Game UI: {url}");
if (config.Lan)
{
    var lan = LanAddresses.Get();
    if (lan.Count == 0)
        Console.WriteLine("  --lan: no network address found; only this computer can open the UI.");
    foreach (var address in lan)
        Console.WriteLine($"  Other devices on the same Wi-Fi: http://{address}:{config.WebPort}");
}
Console.WriteLine("  Ctrl+C stops the client.");

var app = WebHost.Build(config);
try
{
    await app.StartAsync();
}
catch (IOException ex)
{
    Console.WriteLine($"Cannot serve the UI on port {config.WebPort} ({ex.Message}). Is another client running? Try --web-port {config.WebPort + 1}.");
    return 1;
}

if (!args.Contains("--no-browser")) BrowserLauncher.Open(url);
await app.WaitForShutdownAsync();
return 0;

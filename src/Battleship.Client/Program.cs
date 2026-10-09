using System.Text;
using Battleship.Client;
using Microsoft.Extensions.Hosting;

// Usage: Battleship.Client [--web-port <n>] [--no-browser]
Console.OutputEncoding = Encoding.UTF8;
var config = ClientConfig.Load(args);
string url = $"http://localhost:{config.WebPort}";

Console.WriteLine("Battleship client");
Console.WriteLine($"  Server: {config.ServerHost}:{config.ServerPort} (from client.json)");
Console.WriteLine($"  Game UI: {url}");
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

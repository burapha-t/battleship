using System.Net;
using System.Net.Sockets;
using System.Text;
using Battleship.Core;
using Battleship.Server.Dashboard;
using Battleship.Server.Host;
using Battleship.Server.Net;

const int TcpPort = 5050;
const string DashboardUrl = "http://localhost:8080";

Console.OutputEncoding = Encoding.UTF8;
using var stop = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) =>
{
    e.Cancel = true;
    stop.Cancel();
};

var host = new GameHost(TimeSpan.FromSeconds(GameRules.TurnSeconds), new Random());
var acceptLoop = new TcpAcceptLoop(new IPEndPoint(IPAddress.Any, TcpPort), host);
try
{
    acceptLoop.Start();
}
catch (SocketException ex)
{
    Console.WriteLine($"Cannot listen on port {TcpPort}: {ex.Message}. Is another server already running?");
    return 1;
}

var lan = LanAddresses.Get();
Console.WriteLine("Battleship server");
Console.WriteLine($"  Listening on TCP port {TcpPort}. Put one of these in each client's client.json as \"serverHost\":");
foreach (var address in lan) Console.WriteLine($"    {address}");
if (lan.Count == 0) Console.WriteLine("    (no LAN address found; a client on this machine can use 127.0.0.1)");
Console.WriteLine($"  Dashboard: {DashboardUrl}");
Console.WriteLine("  Ctrl+C stops the server.");

var dashboard = DashboardServer.Create(host, DashboardUrl, TcpPort);
try
{
    await dashboard.StartAsync();
}
catch (IOException ex)
{
    Console.WriteLine($"The dashboard could not start ({ex.Message}). The game server keeps running.");
}

await Task.WhenAll(host.RunAsync(stop.Token), acceptLoop.RunAsync(stop.Token));
await dashboard.StopAsync();
return 0;

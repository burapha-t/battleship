using Battleship.Server.Host;
using Battleship.Server.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace Battleship.Server.Dashboard;

/// <summary>
/// The dashboard web page inside the server process. It reads
/// <see cref="GameHost.Snapshot"/> and never touches the roster; RESET only
/// posts <see cref="HostInput.ResetRequested"/> to the loop.
/// </summary>
public static class DashboardServer
{
    /// <param name="url"><c>http://localhost:8080</c> in the real server; tests use <c>http://127.0.0.1:0</c>.</param>
    /// <param name="tcpPort">The game port, shown on the page.</param>
    public static WebApplication Create(GameHost host, string url, int tcpPort)
    {
        var builder = WebApplication.CreateSlimBuilder(new WebApplicationOptions { ContentRootPath = AppContext.BaseDirectory });
        builder.WebHost.UseUrls(url);
        builder.Logging.SetMinimumLevel(LogLevel.Warning);
        var app = builder.Build();

        string page = Path.Combine(AppContext.BaseDirectory, "Dashboard", "index.html");
        var lanAddresses = LanAddresses.Get().Select(address => address.ToString()).ToList();

        app.MapGet("/", () => Results.File(page, "text/html; charset=utf-8"));
        app.MapGet("/api/state", () =>
        {
            var snapshot = host.Snapshot;
            return Results.Json(new
            {
                tcpPort,
                lanAddresses,
                snapshot.Count,
                snapshot.Clients,
                snapshot.Matches,
                snapshot.Activity,
            });
        });
        app.MapPost("/api/reset", () =>
        {
            host.Post(new HostInput.ResetRequested());
            return Results.Accepted();
        });

        return app;
    }
}

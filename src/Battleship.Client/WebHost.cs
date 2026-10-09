using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace Battleship.Client;

/// <summary>
/// The local web host on <c>http://localhost:&lt;webPort&gt;</c>: the built UI
/// from <c>wwwroot/</c> and the <c>/ws</c> endpoint, which hands each
/// WebSocket to <see cref="Relay"/>. Listens on localhost only.
/// </summary>
public static class WebHost
{
    private const string NotBuiltPage =
        "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Battleship</title></head>" +
        "<body style=\"font-family:system-ui,sans-serif;padding:40px\"><h1>Battleship</h1>" +
        "<p>UI not built — run <code>npm run build</code> in <code>web/</code>, then rebuild the client.</p></body></html>";

    public static WebApplication Build(ClientConfig config)
    {
        var builder = WebApplication.CreateSlimBuilder(new WebApplicationOptions { ContentRootPath = AppContext.BaseDirectory });
        builder.WebHost.UseUrls($"http://localhost:{config.WebPort}");
        builder.Logging.SetMinimumLevel(LogLevel.Warning);
        var app = builder.Build();

        app.UseWebSockets();
        app.Map("/ws", async context =>
        {
            if (!context.WebSockets.IsWebSocketRequest)
            {
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                return;
            }
            using var browser = await context.WebSockets.AcceptWebSocketAsync();
            await Relay.RunAsync(browser, config, context.RequestAborted);
        });

        if (File.Exists(Path.Combine(AppContext.BaseDirectory, "wwwroot", "index.html")))
        {
            app.UseDefaultFiles();
            app.UseStaticFiles();
        }
        else
        {
            app.MapGet("/", () => Results.Content(NotBuiltPage, "text/html; charset=utf-8"));
        }

        return app;
    }
}

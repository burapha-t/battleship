using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace Battleship.Client;

public static class WebHost
{
    private const string NotBuiltPage =
        "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Battleship</title></head>" +
        "<body style=\"font-family:system-ui,sans-serif;padding:40px\"><h1>Battleship</h1>" +
        "<p>UI not built — run <code>npm run build</code> in <code>web/</code>, then rebuild the client.</p></body></html>";

    private sealed record StartGhostRequest(string GhostOf);

    public static WebApplication Build(ClientConfig config)
    {
        var builder = WebApplication.CreateSlimBuilder(
            new WebApplicationOptions { ContentRootPath = AppContext.BaseDirectory }
        );
        builder.WebHost.UseUrls($"http://localhost:{config.WebPort}");
        builder.Logging.SetMinimumLevel(LogLevel.Warning);
        var app = builder.Build();

        app.MapPost("/api/ai/history", async (HttpContext context) =>
            await AiProxy.ForwardPostAsync(context, "/history"));

        app.MapPost("/api/ai/sonar", async (HttpContext context) =>
            await AiProxy.ForwardPostAsync(context, "/sonar"));

        app.MapGet("/api/ghost/status", () =>
            Results.Json(AiProcessManager.GetGhostStatus()));

        app.MapPost("/api/ghost/start", async (HttpContext context) =>
        {
            var body = await context.Request.ReadFromJsonAsync<StartGhostRequest>();
            if (body is null || string.IsNullOrWhiteSpace(body.GhostOf))
                return Results.Json(
                    new AiProcessManager.GhostStatus(false, null, "A nickname is required."),
                    statusCode: (int)HttpStatusCode.BadRequest
                );

            var status = AiProcessManager.StartGhost(config, body.GhostOf);
            return Results.Json(
                status,
                statusCode: status.Running
                    ? (int)HttpStatusCode.OK
                    : (int)HttpStatusCode.InternalServerError
            );
        });

        app.MapPost("/api/ghost/stop", () =>
            Results.Json(AiProcessManager.StopGhost()));

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
            app.MapGet("/", () =>
                Results.Content(NotBuiltPage, "text/html; charset=utf-8"));
        }

        return app;
    }
}

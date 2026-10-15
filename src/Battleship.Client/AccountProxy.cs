using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;

namespace Battleship.Client;

/// <summary>Forwards account requests to the server without storing passwords or cookies.</summary>
public sealed class AccountProxy : IDisposable
{
    private readonly HttpClient http;
    public AccountProxy(ClientConfig config)
    {
        http = new HttpClient(new HttpClientHandler { UseCookies = false, AllowAutoRedirect = false })
        {
            BaseAddress = new UriBuilder("http", config.ServerHost, config.AuthPort).Uri,
            Timeout = TimeSpan.FromSeconds(10)
        };
    }

    public void Map(WebApplication app)
    {
        foreach (var action in new[] { "register", "login", "logout", "me", "score" })
        {
            string path = $"/api/auth/{action}";
            app.MapMethods(path, action is "me" or "score" ? ["GET"] : ["POST"], async context =>
            {
                if (!IsAllowedOrigin(context.Request) || (context.Request.Method == "POST" &&
                    (context.Request.Headers["X-Battleship-Request"] != "1" || !context.Request.HasJsonContentType())))
                {
                    context.Response.StatusCode = 403;
                    return;
                }
                try
                {
                    using var request = Request(context, new HttpMethod(context.Request.Method), path);
                    if (context.Request.Method == "POST")
                    {
                        request.Content = new StreamContent(context.Request.Body);
                        request.Content.Headers.ContentType = new("application/json");
                        request.Headers.Add("X-Battleship-Request", "1");
                    }
                    using var response = await http.SendAsync(request, context.RequestAborted);
                    context.Response.StatusCode = (int)response.StatusCode;
                    context.Response.ContentType = response.Content.Headers.ContentType?.ToString();
                    context.Response.Headers.CacheControl = "no-store";
                    if (response.Headers.TryGetValues("Set-Cookie", out var cookies))
                        foreach (var cookie in cookies) context.Response.Headers.Append("Set-Cookie", cookie);
                    await response.Content.CopyToAsync(context.Response.Body, context.RequestAborted);
                }
                catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
                {
                    if (context.RequestAborted.IsCancellationRequested) return;
                    context.Response.StatusCode = 503;
                    await context.Response.WriteAsJsonAsync(new { message = "Account server unavailable. Start Battleship.Server and try again." });
                }
            });
        }
    }

    public async Task<(int Status, string? Ticket)> TicketAsync(HttpContext context)
    {
        if (!IsAllowedOrigin(context.Request)) return (403, null);
        try
        {
            using var request = Request(context, HttpMethod.Post, "/api/auth/game-ticket");
            request.Content = JsonContent.Create(new { });
            request.Headers.Add("X-Battleship-Request", "1");
            using var response = await http.SendAsync(request, context.RequestAborted);
            if (!response.IsSuccessStatusCode) return (response.StatusCode == HttpStatusCode.Unauthorized ? 401 : 503, null);
            var data = await response.Content.ReadFromJsonAsync<TicketResponse>(cancellationToken: context.RequestAborted);
            return string.IsNullOrEmpty(data?.Ticket) ? (503, null) : (200, data.Ticket);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException) { return (503, null); }
    }
    private sealed record TicketResponse(string Ticket);

    private static HttpRequestMessage Request(HttpContext context, HttpMethod method, string path)
    {
        var request = new HttpRequestMessage(method, path);
        if (context.Request.Headers.TryGetValue("Cookie", out var cookie))
            request.Headers.TryAddWithoutValidation("Cookie", cookie.ToString());
        return request;
    }

    // The development frontend uses :5173 and proxies to this localhost host.
    private static bool IsAllowedOrigin(HttpRequest request)
    {
        var origin = request.Headers.Origin.ToString();
        if (origin.Length == 0) return true; // Non-browser clients still need an authenticated cookie.
        if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri)) return false;
        return uri.Scheme == request.Scheme && (uri.Authority == request.Host.Value ||
            (uri.IsLoopback && uri.Port == 5173));
    }

    public void Dispose() => http.Dispose();
}

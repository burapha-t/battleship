using System.Net.Http.Headers;
using Microsoft.AspNetCore.Http;

namespace Battleship.Client;

/// <summary>
/// Same-origin proxy from the browser to the local Python AI helper.
/// It buffers the browser JSON body first so Content-Length is forwarded
/// correctly to Python's BaseHTTPRequestHandler.
/// </summary>
public static class AiProxy
{
    private static readonly HttpClient Client = new()
    {
        BaseAddress = new Uri("http://127.0.0.1:8091"),
        Timeout = TimeSpan.FromSeconds(4),
    };

    public static async Task ForwardPostAsync(HttpContext context, string path)
    {
        try
        {
            using var requestBuffer = new MemoryStream();
            await context.Request.Body.CopyToAsync(requestBuffer, context.RequestAborted);
            byte[] requestBytes = requestBuffer.ToArray();

            using var request = new HttpRequestMessage(HttpMethod.Post, path)
            {
                Content = new ByteArrayContent(requestBytes),
            };

            request.Content.Headers.ContentType = MediaTypeHeaderValue.Parse(
                string.IsNullOrWhiteSpace(context.Request.ContentType)
                    ? "application/json"
                    : context.Request.ContentType
            );

            using var response = await Client.SendAsync(request, context.RequestAborted);
            byte[] responseBytes = await response.Content.ReadAsByteArrayAsync(context.RequestAborted);

            context.Response.StatusCode = (int)response.StatusCode;
            context.Response.ContentType =
                response.Content.Headers.ContentType?.ToString()
                ?? "application/json; charset=utf-8";
            context.Response.ContentLength = responseBytes.Length;

            await context.Response.Body.WriteAsync(responseBytes, context.RequestAborted);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            await context.Response.WriteAsJsonAsync(
                new { error = "AI helper unavailable", detail = ex.Message },
                context.RequestAborted
            );
        }
    }
}

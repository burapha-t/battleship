using System.Collections.Concurrent;
using System.Security.Cryptography;

namespace Battleship.Server.Auth;

/// <summary>Short-lived, single-use credentials issued only after cookie authentication.</summary>
public sealed class GameTickets
{
    private readonly ConcurrentDictionary<string, Entry> tickets = new();
    public string Issue(string accountId, string securityStamp)
    {
        var now = DateTimeOffset.UtcNow;
        foreach (var item in tickets)
            if (item.Value.Expires <= now) tickets.TryRemove(item.Key, out _);
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        tickets[token] = new(accountId, securityStamp, now.AddSeconds(30));
        return token;
    }
    public Entry? Consume(string? token) => token is not null && tickets.TryRemove(token, out var entry)
        && entry.Expires > DateTimeOffset.UtcNow ? entry : null;
    public sealed record Entry(string AccountId, string SecurityStamp, DateTimeOffset Expires);
}

using Battleship.Core.Protocol;

namespace Battleship.IntegrationTests;

public class CancelSearchTests
{
    [Fact]
    public async Task CancelSearch_ReturnsIdle_RemovesStaleQueueEntry_AndCanSearchAgain()
    {
        await using var server = await TestServer.StartAsync();
        await using var alice = await server.JoinAsync("Alice");
        await using var bob = await server.JoinAsync("Bob");

        await alice.SendAsync(new FindMatch());
        await alice.WaitForAsync<LobbyUpdate>(l =>
            l.Clients.Single(c => c.Id == alice.Id).Status == LobbyStatus.Searching);

        await alice.SendAsync(new CancelSearch());
        await alice.WaitForAsync<LobbyUpdate>(l =>
            l.Clients.Single(c => c.Id == alice.Id).Status == LobbyStatus.Idle);

        await bob.SendAsync(new FindMatch());
        await bob.WaitForAsync<LobbyUpdate>(l =>
            l.Clients.Single(c => c.Id == bob.Id).Status == LobbyStatus.Searching);
        Assert.Empty(server.Host.Snapshot.Matches);

        await alice.SendAsync(new FindMatch());
        var start = await alice.WaitForAsync<MatchStart>();
        Assert.Equal(new[] { bob.Id, alice.Id }, start.Players.Select(p => p.Id));
    }
}

using Battleship.Core.Protocol;
using Battleship.Server.Data;

namespace Battleship.IntegrationTests;

// #77 over real TCP with real accounts: a saved picture reaches lobby,
// matchStart and matchEnd, survives a rematch and logging in again, and a
// guest (Ghost Fleet included) has none.
public class AvatarTests : IAsyncLifetime
{
    private readonly string _folder = Path.Combine(Path.GetTempPath(), "battleship-avatar-wire-" + Guid.NewGuid().ToString("N"));
    private GameDatabase _database = null!;
    private TestServer _server = null!;

    public async Task InitializeAsync()
    {
        _database = new GameDatabase(Path.Combine(_folder, "test.db"));
        _server = await TestServer.StartAsync(TimeSpan.FromHours(1), database: _database);
    }

    public async Task DisposeAsync()
    {
        await _server.DisposeAsync();
        GameDatabase.ClearPool(_database.Path);
        if (Directory.Exists(_folder)) Directory.Delete(_folder, recursive: true);
    }

    [Fact]
    public async Task ASavedPicture_ReachesTheLobby_BothMatchMessages_AndTheRematch()
    {
        await using var alice = await _server.SignUpAsync("Alice", "secret1");
        await using var bob = await _server.JoinAsync("Bob");
        await bob.WaitForAsync<LobbyUpdate>(l => l.Count == 2 && l.Clients.All(c => c.Name != null));

        await alice.SendAsync(new ProfileUpdate { Avatar = "shark", ShownBadges = Array.Empty<string>() });
        await alice.WaitForAsync<Profile>();
        // Bob's Home updates without asking: the server re-sends the lobby.
        var lobby = await bob.WaitForAsync<LobbyUpdate>(l => AvatarOf(l, alice.Id) == "shark");
        Assert.Equal("", AvatarOf(lobby, bob.Id));

        var start = await Play.PairAsync(alice, bob);
        Assert.Equal(("shark", ""), (AvatarOf(start.Players, alice.Id), AvatarOf(start.Players, bob.Id)));
        var (fleetA, fleetB, turn) = await Play.PlaceAsync(alice, bob);
        var end = await Play.PlayToWinAsync(alice, fleetA, bob, fleetB, turn);
        Assert.Equal(("shark", ""), (AvatarOf(end.Players, alice.Id), AvatarOf(end.Players, bob.Id)));

        await alice.SendAsync(new Rematch());
        await bob.WaitForAsync<RematchPending>();
        await bob.SendAsync(new Rematch());
        var rematch = await bob.WaitForAsync<MatchStart>();
        Assert.Equal(("shark", ""), (AvatarOf(rematch.Players, alice.Id), AvatarOf(rematch.Players, bob.Id)));
    }

    [Fact]
    public async Task LoggingInAgain_AfterDisconnecting_KeepsThePicture()
    {
        await using (var first = await _server.SignUpAsync("Alice", "secret1"))
        {
            await first.SendAsync(new ProfileUpdate { Avatar = "octopus", ShownBadges = Array.Empty<string>() });
            await first.WaitForAsync<LobbyUpdate>(l => AvatarOf(l, first.Id) == "octopus");
        }
        await _server.WaitUntilAsync(snapshot => snapshot.Count == 0);

        await using var again = await _server.LogInAsync("Alice", "secret1");

        var lobby = await again.NextAsync<LobbyUpdate>();
        Assert.Equal("octopus", AvatarOf(lobby, again.Id));
    }

    [Fact]
    public async Task AGuest_AndGhostFleet_HaveNoPicture()
    {
        await using var guest = await _server.JoinAsync("Carol");
        await using var ghost = await _server.JoinAsync("Ghost Fleet"); // the bot joins as a guest

        var lobby = await guest.WaitForAsync<LobbyUpdate>(l => l.Count == 2 && l.Clients.All(c => c.Name != null));

        Assert.All(lobby.Clients, c => Assert.Equal("", c.Avatar));
    }

    private static string AvatarOf(LobbyUpdate lobby, string id) => lobby.Clients.Single(c => c.Id == id).Avatar;

    private static string AvatarOf(IReadOnlyList<PlayerInfo> players, string id) => players.Single(p => p.Id == id).Avatar;
}

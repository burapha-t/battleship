using System.Reflection;
using Battleship.Core.Protocol;
using Battleship.Server.Data;
using Battleship.Server.Host;
using Battleship.Server.Lobby;

namespace Battleship.IntegrationTests;

// #42 over real TCP: guests can look but not save; an account saves, reads
// back and is refused, and only ever hears about its own profile.
public class ProfileTests : IAsyncLifetime
{
    private readonly string _folder = Path.Combine(Path.GetTempPath(), "battleship-profile-wire-" + Guid.NewGuid().ToString("N"));
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
    public async Task AGuest_GetsAnEmptyGuestProfile_AndCannotSave_EvenWithADatabase()
    {
        await using var guest = await _server.JoinAsync("Alice");
        await guest.WaitForAsync<LobbyUpdate>(l => l.Clients.All(c => c.Name != null));

        await guest.SendAsync(new ProfileGet());
        Assert.Equal(
            "{\"type\":\"profile\",\"guest\":true,\"avatar\":\"\",\"shownBadges\":[],\"rank\":null,\"wins\":0}",
            await guest.NextRawAsync());

        await guest.SendAsync(new ProfileUpdate { Avatar = "whale", ShownBadges = Array.Empty<string>() });
        Assert.Equal(ErrorCodes.NotLoggedIn, (await guest.NextAsync<Error>()).Code);
    }

    [Fact]
    public async Task AnAccount_SavesReadsBackAndIsRefused_PrivatelyAndWithoutChange()
    {
        long aliceId = _database.CreateUser("Alice", new byte[16], new byte[32], 1)!.Value;
        await using var alice = await _server.JoinAsync("Alice");
        await using var bob = await _server.JoinAsync("Bob");
        await alice.WaitForAsync<LobbyUpdate>(l => l.Count == 2 && l.Clients.All(c => c.Name != null));
        await bob.WaitForAsync<LobbyUpdate>(l => l.Clients.All(c => c.Name != null));
        LogIn(alice.Id, aliceId);

        await alice.SendAsync(new ProfileUpdate { Avatar = "pufferfish", ShownBadges = Array.Empty<string>() });
        var saved = await alice.NextAsync<Profile>();
        Assert.False(saved.Guest);
        Assert.Equal("pufferfish", saved.Avatar);
        Assert.Null(saved.Rank);

        await alice.SendAsync(new ProfileUpdate { Avatar = "crab", ShownBadges = new[] { "wins-5" } });
        var refused = await alice.NextAsync<Error>();
        Assert.Equal(ErrorCodes.InvalidProfile, refused.Code);
        Assert.Equal("You can only show badges you have earned.", refused.Message);

        await alice.SendRawAsync("{\"type\":\"profileUpdate\"}");
        Assert.Equal(ErrorCodes.InvalidProfile, (await alice.NextAsync<Error>()).Code);

        await alice.SendAsync(new ProfileGet());
        Assert.Equal("pufferfish", (await alice.NextAsync<Profile>()).Avatar);
        await bob.AssertNothingAsync(TimeSpan.FromMilliseconds(150));
    }

    // Login (#46) isn't built yet, so set the account the way it will.
    private void LogIn(string playerId, long userId)
    {
        var roster = (Roster)typeof(GameHost).GetField("_roster", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(_server.Host)!;
        roster.Find(playerId)!.UserId = userId;
    }
}

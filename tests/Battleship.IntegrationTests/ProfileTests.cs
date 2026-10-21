using System.Reflection;
using Battleship.Core.Protocol;
using Battleship.Server.Data;
using Battleship.Server.Host;
using Battleship.Server.Lobby;
using Microsoft.Data.Sqlite;

namespace Battleship.IntegrationTests;

// #41/#42: real TCP replies stay private and ordered after matchEnd.
public class ProfileTests
{
    [Fact]
    public async Task GuestGetsDefaultsAndCannotSave_WithoutDatabase()
    {
        await using var server = await TestServer.StartAsync();
        await using var a = await server.JoinAsync("Alice");
        await using var b = await server.JoinAsync("Bob");
        await a.WaitForAsync<LobbyUpdate>(l => l.Count == 2 && l.Clients.All(c => c.Name != null));
        await b.WaitForAsync<LobbyUpdate>(l => l.Clients.All(c => c.Name != null));
        await a.SendAsync(new ProfileGet());
        Assert.Equal("{\"type\":\"profile\",\"avatar\":\"\",\"shownBadges\":[],\"wins\":0,\"bestAccuracy\":0,\"bestStreak\":0,\"badges\":[]}", await a.NextRawAsync());
        await a.SendAsync(new ProfileUpdate { Avatar = "whale", ShownBadges = Array.Empty<string>() });
        Assert.Equal(ErrorCodes.NotLoggedIn, (await a.NextAsync<Error>()).Code);
        await b.AssertNothingAsync(TimeSpan.FromMilliseconds(100));
    }

    [Fact]
    public async Task AccountMatchUnlocksOnlyForOwner_AfterMatchEnd_AndProfileUpdatesAreValidated()
    {
        string folder = Path.Combine(Path.GetTempPath(), "battleship-profile-wire-" + Guid.NewGuid().ToString("N"));
        try
        {
            var db = new GameDatabase(Path.Combine(folder, "test.db"));
            long alice = db.CreateUser("Alice", new byte[16], new byte[32], 1)!.Value;
            long bob = db.CreateUser("Bob", new byte[16], new byte[32], 1)!.Value;
            await using var server = await TestServer.StartAsync(TimeSpan.FromHours(1), database: db);
            await using var a = await server.JoinAsync("Alice");
            await using var b = await server.JoinAsync("Bob");
            await a.WaitForAsync<LobbyUpdate>(l => l.Clients.Count == 2 && l.Clients.All(c => c.Name != null));
            await b.WaitForAsync<LobbyUpdate>(l => l.Clients.All(c => c.Name != null));
            // Login (#46) is out of scope. Set identity directly before starting play.
            var roster = (Roster)typeof(GameHost).GetField("_roster", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(server.Host)!;
            roster.Find(a.Id)!.UserId = alice;
            roster.Find(b.Id)!.UserId = bob;
            var start = await Play.PairAsync(a, b);
            var (fa, fb, turn) = await Play.PlaceAsync(a, b);
            await Play.PlayToWinAsync(a, fa, b, fb, turn);
            var unlock = await a.NextAsync<AchievementUnlocked>();
            Assert.Equal(start.MatchId, unlock.MatchId);
            Assert.Contains(unlock.Badges, badge => badge.Code == "accuracy-80");
            Assert.Contains(unlock.Badges, badge => badge.Code == "streak-12");
            await b.AssertNothingAsync(TimeSpan.FromMilliseconds(150));
            var types = a.Received.Select(line => ProtocolJson.Parse(line)!.Type).ToList();
            Assert.True(types.IndexOf("matchEnd") < types.IndexOf("achievementUnlocked"));
            await a.SendAsync(new ProfileGet());
            var profile = await a.NextAsync<Profile>();
            Assert.Equal((1, 100.0, 16), (profile.Wins, profile.BestAccuracy, profile.BestStreak));
            await a.SendAsync(new ProfileUpdate { Avatar = "whale", ShownBadges = new[] { "streak-12" } });
            Assert.Equal("whale", (await a.NextAsync<Profile>()).Avatar);
            await a.SendAsync(new ProfileUpdate { Avatar = "crab", ShownBadges = new[] { "wins-5" } });
            Assert.Equal(ErrorCodes.InvalidProfile, (await a.NextAsync<Error>()).Code);
            await a.SendAsync(new ProfileGet());
            Assert.Equal("whale", (await a.NextAsync<Profile>()).Avatar);
            Assert.DoesNotContain(b.Received, line => ProtocolJson.Parse(line) is Profile or AchievementUnlocked);
        }
        finally { SqliteConnection.ClearAllPools(); if (Directory.Exists(folder)) Directory.Delete(folder, true); }
    }
}

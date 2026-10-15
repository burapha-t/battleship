using System.Net.Http.Json;
using Battleship.Core.Protocol;
using Battleship.Server.Auth;

namespace Battleship.IntegrationTests;

public class AccountScoreTests
{
    private sealed record Profile(string Id);
    private sealed record SavedScore(int Score, int MatchesPlayed);

    private static async Task<string> GetTicket(HttpClient http)
    {
        using var response = await http.PostAsJsonAsync("/api/auth/game-ticket", new { });
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        return json.GetProperty("ticket").GetString()!;
    }

    private static async Task<(TestClient Client, Welcome Welcome)> Join(TestServer server, HttpClient http, string nickname)
    {
        var client = await server.ConnectAsync();
        await client.SendAsync(new Authenticate { Ticket = await GetTicket(http) });
        await client.SendAsync(new Join { Nickname = nickname });
        return (client, await client.NextAsync<Welcome>());
    }

    [Fact]
    public async Task WinIsSaved_RestoresAfterReconnectAndServerRestart_ResetIsPersistent()
    {
        await using var accounts = new TestAccounts();
        await accounts.StartAsync();
        using var aliceHttp = accounts.Client();
        using var bobHttp = accounts.Client();
        await TestAccounts.RegisterAsync(aliceHttp, "alice@example.com");
        await TestAccounts.RegisterAsync(bobHttp, "bob@example.com");
        await TestAccounts.LoginAsync(aliceHttp, "alice@example.com");
        await TestAccounts.LoginAsync(bobHttp, "bob@example.com");
        var aliceId = (await aliceHttp.GetFromJsonAsync<Profile>("/api/auth/me"))!.Id;
        var bobId = (await bobHttp.GetFromJsonAsync<Profile>("/api/auth/me"))!.Id;
        await using (var server = await TestServer.StartAsync(tickets: accounts.Tickets, scores: accounts.Scores))
        {
            var a = await Join(server, aliceHttp, "Alice");
            var b = await Join(server, bobHttp, "Bob");
            await using var alice = a.Client;
            await using var bob = b.Client;
            Assert.Equal(0, a.Welcome.Score);
            await Play.PairAsync(alice, bob);
            var (fleetA, fleetB, turn) = await Play.PlaceAsync(alice, bob);
            var end = await Play.PlayToWinAsync(alice, fleetA, bob, fleetB, turn);
            Assert.Equal(1, end.Players.Single(p => p.Id == alice.Id).Score);
            Assert.Equal(1, accounts.Scores.Load(aliceId));
            Assert.Equal(1, (await aliceHttp.GetFromJsonAsync<SavedScore>("/api/auth/score"))!.Score);
            Assert.Equal(0, accounts.Scores.Load(bobId));
            Assert.Equal(1, accounts.Scores.LoadMatchesPlayed(bobId));
            await server.WaitUntilAsync(s => s.Clients.Any(p => p.AccountId == aliceId && p.Score == 1));
            // A forged matchEnd cannot award a client points.
            await bob.SendAsync(new MatchEnd { WinnerId = bob.Id, MatchId = "fake" });
            await bob.SendAsync(new Rematch());
            await alice.WaitForAsync<RematchPending>();
            await alice.SendAsync(new Rematch());
            var rematch = await alice.WaitForAsync<MatchStart>();
            await bob.WaitForAsync<MatchStart>();
            Assert.Equal(1, rematch.Players.Single(p => p.Id == alice.Id).Score);
            Assert.Equal(0, accounts.Scores.Load(bobId));
            Assert.Equal(1, accounts.Scores.LoadMatchesPlayed(bobId));
            var (againA, againB, againTurn) = await Play.PlaceAsync(alice, bob, 4);
            await Play.PlayToWinAsync(alice, againA, bob, againB, againTurn);
            Assert.Equal(2, accounts.Scores.Load(aliceId));
            // Disconnect/rejoin with a different nickname: account identity wins over nickname.
            await alice.DisposeAsync();
            await server.WaitUntilAsync(s => s.Clients.All(p => p.AccountId != aliceId));
            var rejoined = await Join(server, aliceHttp, "NewNickname");
            await using var renamed = rejoined.Client;
            Assert.Equal(2, rejoined.Welcome.Score);
            Assert.Equal(2, rejoined.Welcome.MatchesPlayed);
        }
        // New GameHost starts match IDs at m1 again; stored points survive.
        await using (var server = await TestServer.StartAsync(tickets: accounts.Tickets, scores: new AccountScores(accounts.DatabasePath)))
        {
            var a = await Join(server, aliceHttp, "Alice");
            var b = await Join(server, bobHttp, "Bob");
            await using var alice = a.Client;
            await using var bob = b.Client;
            Assert.Equal(2, a.Welcome.Score);
            Assert.Equal(2, a.Welcome.MatchesPlayed);
            await Play.PairAsync(alice, bob);
            var (fleetA, fleetB, turn) = await Play.PlaceAsync(alice, bob);
            await Play.PlayToWinAsync(alice, fleetA, bob, fleetB, turn);
            Assert.Equal(3, accounts.Scores.Load(aliceId));
            Assert.Equal(3, accounts.Scores.LoadMatchesPlayed(aliceId));
            Assert.Equal(3, accounts.Scores.LoadMatchesPlayed(bobId));
            (await server.Dashboard.PostAsync("/api/reset", null)).EnsureSuccessStatusCode();
            await alice.WaitForAsync<Reset>();
            await server.WaitUntilAsync(s => s.Clients.All(p => p.Score == 0));
            Assert.Equal(0, accounts.Scores.Load(aliceId));
        }
        await using (var server = await TestServer.StartAsync(tickets: accounts.Tickets, scores: accounts.Scores))
        {
            var a = await Join(server, aliceHttp, "Alice");
            await using var alice = a.Client;
            Assert.Equal(0, a.Welcome.Score);
            Assert.Equal(3, a.Welcome.MatchesPlayed);
        }
    }

    [Fact]
    public async Task DuplicateAccount_ReplayedAndRevokedTicketsCannotBindOrFallBackToGuest()
    {
        await using var accounts = new TestAccounts();
        await accounts.StartAsync();
        using var http = accounts.Client();
        await TestAccounts.RegisterAsync(http);
        await TestAccounts.LoginAsync(http);
        await using var server = await TestServer.StartAsync(tickets: accounts.Tickets, scores: accounts.Scores);
        accounts.OnLogout = id => server.Host.Post(new Battleship.Server.Host.HostInput.AccountLoggedOut(id));
        var ticket = await GetTicket(http);
        await using var first = await server.ConnectAsync();
        await first.SendAsync(new Authenticate { Ticket = ticket });
        await first.SendAsync(new Join { Nickname = "Captain" });
        await first.NextAsync<Welcome>();
        foreach (var bad in new[] { ticket, await GetTicket(http), "forged-account-id" })
        {
            await using var second = await server.ConnectAsync();
            await second.SendAsync(new Authenticate { Ticket = bad });
            Assert.Equal("account-unavailable", (await second.NextAsync<Error>()).Code);
            await second.SendAsync(new Join { Nickname = "Sneaky" });
            await second.SendAsync(new FindMatch());
            await second.AssertNothingAsync(TimeSpan.FromMilliseconds(50));
        }
        var revoked = await GetTicket(http);
        (await http.PostAsJsonAsync("/api/auth/logout", new { })).EnsureSuccessStatusCode();
        await server.WaitUntilAsync(s => s.Clients.All(p => p.Name != "Captain"));
        await using var afterLogout = await server.ConnectAsync();
        await afterLogout.SendAsync(new Authenticate { Ticket = revoked });
        Assert.Equal("account-unavailable", (await afterLogout.NextAsync<Error>()).Code);
    }

    [Fact]
    public async Task SchemaUpgradePreservesAccount_IdempotentWins_AndGuestsCannotClaimItsScore()
    {
        await using var accounts = new TestAccounts();
        await accounts.StartAsync();
        using var http = accounts.Client();
        await TestAccounts.RegisterAsync(http);
        await TestAccounts.LoginAsync(http);
        var id = (await http.GetFromJsonAsync<Profile>("/api/auth/me"))!.Id;
        accounts.Scores.Initialize(); // Repeat startup must not destroy an existing account or scores.
        accounts.Scores.RecordMatch("same-match", id, new[] { id });
        accounts.Scores.RecordMatch("same-match", id, new[] { id });
        accounts.Scores.Initialize();
        Assert.Equal(1, accounts.Scores.Load(id));
        Assert.Equal(1, accounts.Scores.LoadMatchesPlayed(id));
        await TestAccounts.LoginAsync(http);
        await using var server = await TestServer.StartAsync(tickets: accounts.Tickets, scores: accounts.Scores);
        await using var guest = await server.JoinAsync("Captain");
        await server.WaitUntilAsync(s => s.Clients.Any(p => p.Id == guest.Id));
        Assert.Null(server.Host.Snapshot.Clients.Single(p => p.Id == guest.Id).AccountId);
        Assert.Equal(0, server.Host.Snapshot.Clients.Single(p => p.Id == guest.Id).Score);
        (await server.Dashboard.PostAsync("/api/reset", null)).EnsureSuccessStatusCode();
        await guest.WaitForAsync<Reset>();
        Assert.Equal(1, accounts.Scores.Load(id)); // Offline accounts are not reset.
    }
    [Fact]
    public async Task AbandonedMatchDoesNotCount_AndGuestWinnerCountsForAccountLoser()
    {
        await using var accounts = new TestAccounts();
        await accounts.StartAsync();
        using var http = accounts.Client();
        await TestAccounts.RegisterAsync(http);
        await TestAccounts.LoginAsync(http);
        var id = (await http.GetFromJsonAsync<Profile>("/api/auth/me"))!.Id;
        await using var server = await TestServer.StartAsync(tickets: accounts.Tickets, scores: accounts.Scores);
        var joined = await Join(server, http, "Captain");
        await using var captain = joined.Client;
        await using (var guest = await server.JoinAsync("Guest"))
        {
            await Play.PairAsync(captain, guest);
            await Play.PlaceAsync(captain, guest);
        }
        await captain.WaitForAsync<OpponentLeft>();
        Assert.Equal(0, accounts.Scores.LoadMatchesPlayed(id));
        await using var winner = await server.JoinAsync("GuestWinner");
        await Play.PairAsync(captain, winner);
        var (a, b, turn) = await Play.PlaceAsync(captain, winner);
        var end = await Play.PlayToWinAsync(winner, b, captain, a, turn);
        Assert.Equal(1, end.Players.Single(p => p.Id == captain.Id).MatchesPlayed);
        Assert.Equal(1, accounts.Scores.LoadMatchesPlayed(id));
        Assert.Equal(0, accounts.Scores.Load(id));
        await server.WaitUntilAsync(s => s.Clients.Any(p => p.AccountId == id && p.MatchesPlayed == 1));
        Assert.Contains("Matches played", await server.Dashboard.GetStringAsync("/"));
        Assert.Equal(1, (await http.GetFromJsonAsync<SavedScore>("/api/auth/score"))!.MatchesPlayed);
    }

    [Fact]
    public async Task UpgradeKeepsOldScore_AndMatchTransactionRollsBackBothStatsOnFailure()
    {
        await using var accounts = new TestAccounts();
        await accounts.StartAsync();
        using var http = accounts.Client();
        await TestAccounts.RegisterAsync(http);
        await TestAccounts.LoginAsync(http);
        var id = (await http.GetFromJsonAsync<Profile>("/api/auth/me"))!.Id;
        // Simulate the prior score-only database; all writes are in this test's temporary DB.
        using (var connection = new Microsoft.Data.Sqlite.SqliteConnection($"Data Source={accounts.DatabasePath}"))
        {
            connection.Open();
            using var command = connection.CreateCommand();
            command.CommandText = "DROP TABLE RecordedMatches; DROP TABLE AccountMatchTotals; INSERT INTO AccountScores (AccountId, Score) VALUES ($id, 5)";
            command.Parameters.AddWithValue("$id", id);
            command.ExecuteNonQuery();
        }
        accounts.Scores.Initialize();
        Assert.Equal(5, accounts.Scores.Load(id));
        Assert.Equal(0, accounts.Scores.LoadMatchesPlayed(id));
        await TestAccounts.LoginAsync(http);
        Assert.Throws<Microsoft.Data.Sqlite.SqliteException>(() =>
            accounts.Scores.RecordMatch("atomic", id, new[] { id, "missing-account" }));
        Assert.Equal(5, accounts.Scores.Load(id));
        Assert.Equal(0, accounts.Scores.LoadMatchesPlayed(id));
        accounts.Scores.RecordMatch("atomic", id, new[] { id });
        accounts.Scores.RecordMatch("atomic", id, new[] { id });
        Assert.Equal(6, accounts.Scores.Load(id));
        Assert.Equal(1, accounts.Scores.LoadMatchesPlayed(id));
    }

}

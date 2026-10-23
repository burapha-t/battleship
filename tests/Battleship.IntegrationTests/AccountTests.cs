using System.Reflection;
using Battleship.Core.Protocol;
using Battleship.Server.Accounts;
using Battleship.Server.Data;
using Battleship.Server.Host;

namespace Battleship.IntegrationTests;

// LOGIN-1 (#46) over real TCP: signup and login against a temporary database,
// with a low hash cost.
public class AccountTests : IAsyncLifetime
{
    private const string InvalidInput = "Usernames must be 1-16 characters and passwords 4-16 characters.";
    private const string NoAccounts = "Accounts aren't available on this server. Play as a guest.";
    private const string AlreadyJoined = "You have already joined.";

    private readonly string _folder = Path.Combine(Path.GetTempPath(), "battleship-accounts-" + Guid.NewGuid().ToString("N"));
    private GameDatabase _database = null!;
    private TestServer _server = null!;

    private string DatabasePath => Path.Combine(_folder, "test.db");

    public async Task InitializeAsync()
    {
        _database = new GameDatabase(DatabasePath);
        _server = await TestServer.StartAsync(TimeSpan.FromHours(1), database: _database);
    }

    public async Task DisposeAsync()
    {
        await _server.DisposeAsync();
        GameDatabase.ClearPool(DatabasePath);
        if (Directory.Exists(_folder)) Directory.Delete(_folder, recursive: true);
    }

    // ---- The DoD (#46) ----

    [Fact]
    public async Task Signup_ThenRestart_ThenLogin_WelcomesTheSameName()
    {
        await using (var first = await _server.SignUpAsync("Alice", "hunter22"))
            Assert.Equal("Alice", first.Name);

        await _server.DisposeAsync();
        GameDatabase.ClearPool(DatabasePath);
        _database = new GameDatabase(DatabasePath);
        _server = await TestServer.StartAsync(TimeSpan.FromHours(1), database: _database);

        await using var again = await _server.ConnectAsync();
        await again.SendAsync(new Login { Username = "alice", Password = "hunter22" });
        Assert.Equal($"{{\"type\":\"welcome\",\"id\":\"{again.Id}\",\"nickname\":\"Alice\"}}", await again.NextRawAsync());
        var lobby = await again.NextAsync<LobbyUpdate>();
        Assert.Equal("Alice", Assert.Single(lobby.Clients).Name);
    }

    [Fact]
    public async Task Signup_SameNameOtherCase_IsUsernameTaken()
    {
        await using var alice = await _server.SignUpAsync("Alice", "hunter22");
        await using var other = await _server.ConnectAsync();

        await other.SendAsync(new Signup { Username = "alice", Password = "other-pass" });

        var error = await other.NextAsync<Error>();
        Assert.Equal(ErrorCodes.UsernameTaken, error.Code);
        Assert.Equal("That username is taken.", error.Message);
    }

    [Theory]
    [InlineData("signup", "", "hunter22")]
    [InlineData("signup", "aaaaaaaaaaaaaaaaa", "hunter22")] // 17
    [InlineData("signup", "Alice", "abc")]
    [InlineData("signup", "Alice", "aaaaaaaaaaaaaaaaa")] // 17
    [InlineData("login", "", "hunter22")]
    [InlineData("login", "aaaaaaaaaaaaaaaaa", "hunter22")]
    [InlineData("login", "Alice", "abc")]
    [InlineData("login", "Alice", "aaaaaaaaaaaaaaaaa")]
    public async Task BadLengths_AreInvalidInput(string verb, string username, string password)
    {
        await using var client = await _server.ConnectAsync();

        await client.SendAsync(verb == "signup"
            ? new Signup { Username = username, Password = password }
            : new Login { Username = username, Password = password });

        var error = await client.NextAsync<Error>();
        Assert.Equal(ErrorCodes.InvalidInput, error.Code);
        Assert.Equal(InvalidInput, error.Message);
        Assert.Null(_database.FindUser("Alice"));
    }

    // protocol.md §5: a missing or null field counts as empty.
    [Theory]
    [InlineData("{\"type\":\"login\"}")]
    [InlineData("{\"type\":\"signup\",\"username\":\"Alice\",\"password\":null}")]
    public async Task MissingOrNullFields_AreInvalidInput(string line)
    {
        await using var client = await _server.ConnectAsync();

        await client.SendRawAsync(line);

        Assert.Equal(ErrorCodes.InvalidInput, (await client.NextAsync<Error>()).Code);
    }

    [Fact]
    public async Task WrongPassword_AndUnknownName_GetTheSameFrame()
    {
        CreateAccount("Alice", "hunter22");
        await using var wrong = await _server.ConnectAsync();
        await using var unknown = await _server.ConnectAsync();

        await wrong.SendAsync(new Login { Username = "Alice", Password = "hunter23" });
        await unknown.SendAsync(new Login { Username = "Nobody", Password = "hunter22" });

        string wrongFrame = await wrong.NextRawAsync();
        Assert.Equal(wrongFrame, await unknown.NextRawAsync());
        var error = Assert.IsType<Error>(ProtocolJson.Parse(wrongFrame));
        Assert.Equal(ErrorCodes.BadCredentials, error.Code);
        Assert.Equal("Wrong username or password.", error.Message);
    }

    [Fact]
    public async Task SecondSessionOnOneAccount_IsAlreadyLoggedIn()
    {
        CreateAccount("Alice", "hunter22");
        await using var first = await _server.LogInAsync("Alice", "hunter22");
        await first.NextAsync<LobbyUpdate>();
        await using var second = await _server.ConnectAsync();

        await second.SendAsync(new Login { Username = "alice", Password = "hunter22" });

        var error = await second.NextAsync<Error>();
        Assert.Equal(ErrorCodes.AlreadyLoggedIn, error.Code);
        Assert.Equal("That account is already logged in.", error.Message);

        // The first session keeps playing.
        await first.SendAsync(new FindMatch());
        await first.WaitForAsync<LobbyUpdate>(l => l.Clients.Any(c => c.Id == first.Id && c.Status == LobbyStatus.Searching));
    }

    [Fact]
    public async Task TwoLoginsAtOnce_OneWelcome()
    {
        CreateAccount("Alice", "hunter22");
        await using var a = await _server.ConnectAsync();
        await using var b = await _server.ConnectAsync();

        await Task.WhenAll(
            a.SendAsync(new Login { Username = "Alice", Password = "hunter22" }),
            b.SendAsync(new Login { Username = "alice", Password = "hunter22" }));

        var replies = new[] { ProtocolJson.Parse(await a.NextRawAsync()), ProtocolJson.Parse(await b.NextRawAsync()) };
        Assert.Equal("Alice", Assert.Single(replies.OfType<Welcome>()).Nickname);
        Assert.Equal(ErrorCodes.AlreadyLoggedIn, Assert.Single(replies.OfType<Error>()).Code);
    }

    // ---- Who may sign up or log in ----

    [Fact]
    public async Task NoDatabase_SignupAndLogin_AreUnknown()
    {
        await using var server = await TestServer.StartAsync();
        await using var client = await server.ConnectAsync();

        foreach (ProtocolMessage message in new ProtocolMessage[]
                 {
                     new Signup { Username = "Alice", Password = "hunter22" },
                     new Login { Username = "Alice", Password = "hunter22" },
                 })
        {
            await client.SendAsync(message);
            var error = await client.NextAsync<Error>();
            Assert.Equal(ErrorCodes.Unknown, error.Code);
            Assert.Equal(NoAccounts, error.Message);
        }

        // join still works.
        await client.SendAsync(new Join { Nickname = "Alice" });
        Assert.Equal("Alice", (await client.NextAsync<Welcome>()).Nickname);
    }

    [Fact]
    public async Task AfterWelcome_SignupAndLogin_AreUnknown()
    {
        CreateAccount("Alice", "hunter22");
        await using var guest = await _server.JoinAsync("Guest");
        await using var account = await _server.LogInAsync("Alice", "hunter22");

        foreach (var client in new[] { guest, account })
        {
            foreach (ProtocolMessage message in new ProtocolMessage[]
                     {
                         new Signup { Username = "Carol", Password = "hunter22" },
                         new Login { Username = "Alice", Password = "hunter22" },
                         new Join { Nickname = "Carol" },
                     })
            {
                await client.SendAsync(message);
                var error = await client.WaitForAsync<Error>();
                Assert.Equal(ErrorCodes.Unknown, error.Code);
                Assert.Equal(AlreadyJoined, error.Message);
            }
        }
        Assert.Null(_database.FindUser("Carol"));
    }

    [Fact]
    public async Task TwoAccounts_FinishedMatch_IsSaved()
    {
        await using var alice = await _server.SignUpAsync("Alice", "hunter22");
        await using var bob = await _server.SignUpAsync("Bob", "hunter22");
        await alice.WaitForAsync<LobbyUpdate>(l => l.Count == 2 && l.Clients.All(c => c.Name != null));
        await bob.WaitForAsync<LobbyUpdate>(l => l.Clients.All(c => c.Name != null));

        await Play.PairAsync(alice, bob);
        var (fleetA, fleetB, turn) = await Play.PlaceAsync(alice, bob);
        await Play.PlayToWinAsync(alice, fleetA, bob, fleetB, turn);

        foreach (var client in new[] { alice, bob })
        {
            await client.SendAsync(new HistoryList());
            Assert.Equal(1, (await client.WaitForAsync<History>()).Stats.MatchCount);
        }
    }

    // ---- Review focus ----

    // 1. login then join in one write: join is welcomed while the password is
    // still being checked, so the login's outcome must change nothing.
    [Fact]
    public async Task LoginThenJoin_InOneWrite_StaysAGuest()
    {
        CreateAccount("Alice", "hunter22");
        // Hold the database queue so the join is certainly welcomed first.
        using var gate = new ManualResetEventSlim();
        Worker().Enqueue(_ => gate.Wait(TestClient.DefaultTimeout));
        await using var client = await _server.ConnectAsync();

        await client.WriteRawAsync(
            ProtocolJson.Serialize(new Login { Username = "Alice", Password = "hunter22" }) + "\n" +
            ProtocolJson.Serialize(new Join { Nickname = "Sailor" }) + "\n");
        Assert.Equal("Sailor", (await client.NextAsync<Welcome>()).Nickname);
        await client.NextAsync<LobbyUpdate>();
        gate.Set();

        // leaderboardGet is answered from the same queue, after the login job:
        // nothing (no second welcome, no error) may come before its reply.
        await client.SendAsync(new LeaderboardGet());
        Assert.IsType<Leaderboard>(ProtocolJson.Parse(await client.NextRawAsync()));
        await client.SendAsync(new ProfileGet());
        Assert.True((await client.NextAsync<Profile>()).Guest);

        // The account isn't held by the guest.
        await using var alice = await _server.LogInAsync("alice", "hunter22");
        Assert.Equal("Alice", alice.Name);
    }

    // 2. One name in two casings at the same moment: the UNIQUE constraint picks one.
    [Fact]
    public async Task SimultaneousSignups_SameNameAnyCase_OneWins()
    {
        await using var a = await _server.ConnectAsync();
        await using var b = await _server.ConnectAsync();

        await Task.WhenAll(
            a.SendAsync(new Signup { Username = "Alice", Password = "hunter22" }),
            b.SendAsync(new Signup { Username = "ALICE", Password = "hunter33" }));

        var replies = new[] { ProtocolJson.Parse(await a.NextRawAsync()), ProtocolJson.Parse(await b.NextRawAsync()) };
        var welcome = Assert.Single(replies.OfType<Welcome>());
        Assert.Equal(ErrorCodes.UsernameTaken, Assert.Single(replies.OfType<Error>()).Code);
        Assert.Equal(welcome.Nickname, _database.FindUser("alice")!.Username);
    }

    // 3. "Already logged in" is by account, not name (D6).
    [Fact]
    public async Task GuestNamedLikeAnAccount_DoesNotBlockItsLogin()
    {
        CreateAccount("Alice", "hunter22");
        await using var guest = await _server.JoinAsync("Alice");

        await using var account = await _server.LogInAsync("alice", "hunter22");

        Assert.Equal("Alice", guest.Name);
        Assert.Equal("Alice", account.Name);
        var lobby = await account.NextAsync<LobbyUpdate>();
        Assert.Equal(new[] { "Alice", "Alice" }, lobby.Clients.Select(c => c.Name));
    }

    // 4. "pass " and "pass" are different passwords.
    [Fact]
    public async Task Password_IsNotTrimmed()
    {
        await using (await _server.SignUpAsync("Alice", "pass ")) { }
        await _server.WaitUntilAsync(s => s.Count == 0);

        await using var client = await _server.ConnectAsync();
        await client.SendAsync(new Login { Username = "Alice", Password = "pass" });
        Assert.Equal(ErrorCodes.BadCredentials, (await client.NextAsync<Error>()).Code);

        await client.SendAsync(new Login { Username = "Alice", Password = "pass " });
        Assert.Equal("Alice", (await client.NextAsync<Welcome>()).Nickname);
    }

    // 5. Thai, counted in UTF-16 units like the web.
    [Fact]
    public async Task ThaiUsernameAndPassword_Work()
    {
        await using (var first = await _server.SignUpAsync("กัปตัน", "รหัสผ่าน"))
            Assert.Equal("กัปตัน", first.Name);
        await _server.WaitUntilAsync(s => s.Count == 0);

        await using var again = await _server.LogInAsync("กัปตัน", "รหัสผ่าน");
        Assert.Equal("กัปตัน", again.Name);
    }

    // An account made the way signup makes one, without a session.
    private void CreateAccount(string username, string password)
    {
        var hasher = new PasswordHasher(TestServer.HashIterations);
        var (salt, hash) = hasher.Hash(password);
        Assert.NotNull(_database.CreateUser(username, salt, hash, hasher.Iterations));
    }

    private DatabaseWorker Worker() =>
        (DatabaseWorker)typeof(GameHost).GetField("_database", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(_server.Host)!;
}

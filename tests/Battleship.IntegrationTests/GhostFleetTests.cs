using System.Diagnostics;
using Battleship.Core;
using Battleship.Core.Protocol;

namespace Battleship.IntegrationTests;

public class GhostFleetTests
{
    [Fact]
    public async Task PythonGhost_PlaysFullMatch_AndPlacesAgainForRematch()
    {
        var root = new DirectoryInfo(AppContext.BaseDirectory);
        while (root != null && !File.Exists(Path.Combine(root.FullName, "Battleship.sln")))
            root = root.Parent;
        Assert.NotNull(root);
        await using var server = await TestServer.StartAsync(random: new Random(42));
        var info = new ProcessStartInfo
        {
            FileName = Environment.GetEnvironmentVariable("BATTLESHIP_PYTHON")
                ?? (OperatingSystem.IsWindows() ? "python" : "python3"),
            WorkingDirectory = root!.FullName,
            UseShellExecute = false,
            RedirectStandardError = true,
            RedirectStandardOutput = true,
        };
        foreach (var arg in new[] { "-m", "bot.main", "--port", server.Port.ToString(), "--seed", "42" })
            info.ArgumentList.Add(arg);
        using var ghost = Process.Start(info)!;
        var errors = ghost.StandardError.ReadToEndAsync();
        var output = ghost.StandardOutput.ReadToEndAsync();
        try
        {
            await using var human = await server.JoinAsync("Normal Client");
            await human.SendAsync(new FindMatch());
            await human.WaitForAsync<MatchStart>(timeout: TimeSpan.FromSeconds(15));
            await human.SendAsync(new Place { Ships = RandomPlacement.Generate(new Random(7)) });
            var shots = new HashSet<Coord>();
            int next = 0;
            var deadline = DateTime.UtcNow.AddSeconds(90);
            MatchEnd? end = null;
            while (end == null && DateTime.UtcNow < deadline)
            {
                var message = ProtocolJson.Parse(await human.NextRawAsync(TimeSpan.FromSeconds(12)));
                Assert.IsNotType<Error>(message);
                if (message is Turn turn && turn.ActivePlayerId == human.Id)
                {
                    await human.SendAsync(new Fire { Row = next / 8, Col = next % 8 });
                    next++;
                }
                if (message is FireResult result && result.By != human.Id)
                {
                    Assert.False(result.Auto);
                    Assert.True(shots.Add(new Coord(result.Row, result.Col)));
                }
                end = message as MatchEnd;
            }
            Assert.NotNull(end);
            Assert.NotEmpty(shots);
            await human.SendAsync(new Rematch());
            var rematch = await human.WaitForAsync<MatchStart>();
            Assert.Equal(end!.WinnerId, rematch.FirstPlayerId);
            await human.WaitForAsync<Placed>(p => p.Id != human.Id);
            Assert.False(ghost.HasExited);
        }
        finally
        {
            if (!ghost.HasExited) ghost.Kill(entireProcessTree: true);
            await ghost.WaitForExitAsync();
            await output;
        }
        Assert.DoesNotContain("Server rejected", await errors);
    }
}

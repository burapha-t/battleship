using Battleship.Core.Protocol;
using static Battleship.Server.Tests.EngineSetup;

namespace Battleship.Server.Tests;

// #77: each player's saved picture, kept on PlayerRecord, in lobby,
// matchStart and matchEnd; "" for a guest. No database or sockets.
public class AvatarTests
{
    private readonly EngineSetup _setup = new();

    public AvatarTests()
    {
        _setup.Join("p1", "Alice").Avatar = "shark";
        _setup.Join("p2", "Bob"); // a guest: no picture
    }

    [Fact]
    public void TheLobby_ListsEachPlayersAvatar_AndAGuestsIsEmpty()
    {
        var lobby = _setup.Roster.BuildLobby();

        Assert.Equal(new[] { ("p1", "shark"), ("p2", "") }, lobby.Clients.Select(c => (c.Id, c.Avatar)));
    }

    [Fact]
    public void MatchStartAndMatchEnd_CarryBothAvatars()
    {
        _setup.Engine.FindMatch("p1");
        var start = Messages<MatchStart>(_setup.Engine.FindMatch("p2")).First();
        _setup.Engine.Place("p1", FleetA);
        _setup.Engine.Place("p2", FleetB);
        var end = Messages<MatchEnd>(_setup.PlayToWin("p1")).First();

        Assert.Equal(new[] { ("p1", "shark"), ("p2", "") }, start.Players.Select(p => (p.Id, p.Avatar)).OrderBy(p => p.Id));
        Assert.Equal(new[] { ("p1", "shark"), ("p2", "") }, end.Players.Select(p => (p.Id, p.Avatar)).OrderBy(p => p.Id));
    }

    [Fact]
    public void ARematch_KeepsBothAvatars_AndShowsAPictureChangedSince()
    {
        _setup.Engine.FindMatch("p1");
        _setup.Engine.FindMatch("p2");
        _setup.Engine.Place("p1", FleetA);
        _setup.Engine.Place("p2", FleetB);
        _setup.PlayToWin("p1");
        _setup.Roster.Find("p2")!.Avatar = "crab"; // as after a profile saved between matches

        _setup.Engine.Rematch("p1");
        var start = Messages<MatchStart>(_setup.Engine.Rematch("p2")).Single();

        Assert.Equal(new[] { ("p1", "shark"), ("p2", "crab") }, start.Players.Select(p => (p.Id, p.Avatar)).OrderBy(p => p.Id));
    }
}

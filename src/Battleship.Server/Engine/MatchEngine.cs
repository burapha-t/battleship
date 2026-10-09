using Battleship.Core;
using Battleship.Core.Protocol;
using Battleship.Server.Host;
using Battleship.Server.Lobby;

namespace Battleship.Server.Engine;

/// <summary>
/// Matchmaking and every running match. <see cref="GameHost"/> calls one
/// method per verb or timer expiry and sends what it returns. Plain
/// synchronous code: no sockets, no async, no locks.
/// </summary>
public sealed class MatchEngine
{
    private static readonly IReadOnlyList<Outbound> None = Array.Empty<Outbound>();

    private readonly Roster _roster;
    private readonly ITurnTimer _timer;
    private readonly Random _random;
    private readonly List<string> _searching = new();
    private readonly Dictionary<string, Match> _matches = new();
    private int _matchCount;

    public MatchEngine(Roster roster, ITurnTimer timer, Random random)
    {
        _roster = roster;
        _timer = timer;
        _random = random;
    }

    /// <summary>Running matches, finished ones included until a rematch, leave or reset.</summary>
    public IEnumerable<Match> Matches => _matches.Values;

    /// <summary>Searching player ids, first come first.</summary>
    public IReadOnlyList<string> Searching => _searching;

    /// <summary>
    /// An idle player starts searching; the first two searchers are paired.
    /// A repeat while searching is ignored.
    /// </summary>
    public IReadOnlyList<Outbound> FindMatch(string playerId)
    {
        var player = _roster.Find(playerId);
        if (player == null || player.Status == LobbyStatus.Searching) return None;
        if (player.Status != LobbyStatus.Idle)
            return new[] { Outbound.Error(playerId, ErrorCodes.NotInMatch, "You can only look for a match from the lobby.") };

        player.Status = LobbyStatus.Searching;
        _searching.Add(playerId);
        if (_searching.Count < 2) return None;

        var first = _roster.Find(_searching[0])!;
        var second = _roster.Find(_searching[1])!;
        _searching.RemoveRange(0, 2);
        return StartMatch(first, second, firstPlayerId: null);
    }

    public IReadOnlyList<Outbound> Place(string playerId, IReadOnlyList<IReadOnlyList<Coord>> ships) =>
        MatchOf(playerId) is { } match ? Track(match, match.Place(playerId, ships)) : NotInMatch(playerId);

    public IReadOnlyList<Outbound> Fire(string playerId, int row, int col) =>
        MatchOf(playerId) is { } match ? Track(match, match.Fire(playerId, row, col)) : NotInMatch(playerId);

    /// <summary>
    /// The second player's request replaces the finished match with a new
    /// one, and the winner goes first.
    /// </summary>
    public IReadOnlyList<Outbound> Rematch(string playerId)
    {
        var match = MatchOf(playerId);
        if (match == null) return NotInMatch(playerId);

        var outbounds = match.Rematch(playerId);
        if (!match.BothWantRematch) return outbounds;

        _matches.Remove(match.Id);
        return StartMatch(match.Players[0], match.Players[1], match.WinnerId);
    }

    /// <summary>Auto-fires if that turn is still current; a stale expiry is dropped.</summary>
    public IReadOnlyList<Outbound> TurnExpired(string matchId, int turnNumber) =>
        _matches.TryGetValue(matchId, out var match) ? Track(match, match.TurnExpired(turnNumber)) : None;

    /// <summary>
    /// A player's socket closed. Their match ends and the opponent gets
    /// <c>opponentLeft</c>, goes idle and keeps their score. The caller
    /// removes the player from the roster.
    /// </summary>
    public IReadOnlyList<Outbound> PlayerLeft(string playerId)
    {
        _searching.Remove(playerId);
        var match = MatchOf(playerId);
        if (match == null) return None;

        End(match);
        var survivor = match.Players.First(player => player.Id != playerId);
        survivor.Status = LobbyStatus.Idle;
        return new[] { Outbound.ToPlayer(survivor.Id, new OpponentLeft { Id = playerId }) };
    }

    /// <summary>
    /// Ends every match, empties the search, zeroes every score and makes
    /// every joined player idle. Sends nothing: the caller sends <c>reset</c>.
    /// </summary>
    public void Reset()
    {
        foreach (var match in _matches.Values.ToList()) End(match);
        _searching.Clear();
        foreach (var player in _roster.Players)
        {
            player.Score = 0;
            if (player.HasJoined) player.Status = LobbyStatus.Idle;
        }
    }

    private IReadOnlyList<Outbound> StartMatch(PlayerRecord first, PlayerRecord second, string? firstPlayerId)
    {
        var match = new Match($"m{++_matchCount}", first, second, _random, firstPlayerId);
        _matches.Add(match.Id, match);
        return match.Start();
    }

    private void End(Match match)
    {
        _matches.Remove(match.Id);
        _timer.Cancel(match.Id);
    }

    private Match? MatchOf(string playerId) => _matches.Values.FirstOrDefault(match => match.Has(playerId));

    // Every turn sent starts that turn's timer; a finished match has none.
    private IReadOnlyList<Outbound> Track(Match match, IReadOnlyList<Outbound> outbounds)
    {
        if (outbounds.Any(outbound => outbound.Message is Turn)) _timer.Start(match.Id, match.TurnNumber);
        else if (match.Phase == MatchPhase.MatchEnd) _timer.Cancel(match.Id);
        return outbounds;
    }

    private static IReadOnlyList<Outbound> NotInMatch(string playerId) =>
        new[] { Outbound.Error(playerId, ErrorCodes.NotInMatch, "You are not in a match.") };
}

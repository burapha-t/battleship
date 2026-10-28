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
    private readonly IMatchArchive? _archive;
    private readonly List<string> _searching = new();
    private readonly Dictionary<string, string> _matchKeys = new();
    private readonly Dictionary<string, Match> _matches = new();
    private int _matchCount;

    /// <param name="archive">Gets every finished match between two accounts; null saves nothing.</param>
    public MatchEngine(Roster roster, ITurnTimer timer, Random random, IMatchArchive? archive = null)
    {
        _roster = roster;
        _timer = timer;
        _random = random;
        _archive = archive;
    }

    /// <summary>Running matches, finished ones included until a rematch, leave or reset.</summary>
    public IEnumerable<Match> Matches => _matches.Values;

    /// <summary>Searching player ids, first come first.</summary>
    public IReadOnlyList<string> Searching => _searching;

    /// <summary>
    /// An idle player starts searching; the first two searchers are paired.
    /// A repeat while searching is ignored.
    /// </summary>
    public IReadOnlyList<Outbound> FindMatch(string playerId, string? matchKey = null)
    {
        var player = _roster.Find(playerId);
        if (player == null || player.Status == LobbyStatus.Searching) return None;
        if (player.Status != LobbyStatus.Idle)
            return new[] { Outbound.Error(playerId, ErrorCodes.NotInMatch, "You can only look for a match from the lobby.") };

        if (matchKey != null && (matchKey.Length != 32 || !matchKey.All(Uri.IsHexDigit)))
            return new[] { Outbound.Error(playerId, ErrorCodes.InvalidInput, "Invalid private match key.") };
        _matchKeys[playerId] = matchKey ?? "";
        player.Status = LobbyStatus.Searching;
        _searching.Add(playerId);
        var partnerId = _searching.FirstOrDefault(id => id != playerId && _matchKeys[id] == _matchKeys[playerId]);
        if (partnerId == null) return None;

        var first = _roster.Find(partnerId)!;
        var second = player;
        _searching.Remove(partnerId);
        _searching.Remove(playerId);
        _matchKeys.Remove(partnerId);
        _matchKeys.Remove(playerId);
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

    /// <summary>
    /// The player pressed Home. Works after a match ends, and while placing
    /// for the race where the opponent's rematch starts a new match just as
    /// the player leaves. The match and any pending rematch are dropped, both
    /// players go idle and keep their scores, and the other player gets
    /// <c>opponentLeft</c>. A repeat from an idle player (both pressed Home)
    /// is ignored.
    /// </summary>
    public IReadOnlyList<Outbound> Leave(string playerId)
    {
        var match = MatchOf(playerId);
        if (match == null && _roster.Find(playerId)?.Status == LobbyStatus.Idle) return None;
        if (match == null || match.Phase == MatchPhase.Playing)
            return new[] { Outbound.Error(playerId, ErrorCodes.NotInMatch, "You can only go home after a match ends.") };

        End(match);
        foreach (var player in match.Players) player.Status = LobbyStatus.Idle;
        var other = match.Players.First(player => player.Id != playerId);
        return new[] { Outbound.ToPlayer(other.Id, new OpponentLeft { Id = playerId }) };
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
        _matchKeys.Remove(playerId);
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
        _matchKeys.Clear();
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
    // The matchEnd frame is sent once per match, so the match is saved once.
    private IReadOnlyList<Outbound> Track(Match match, IReadOnlyList<Outbound> outbounds)
    {
        if (outbounds.Any(outbound => outbound.Message is Turn)) _timer.Start(match.Id, match.TurnNumber);
        else if (match.Phase == MatchPhase.MatchEnd) _timer.Cancel(match.Id);
        if (outbounds.Any(outbound => outbound.Message is MatchEnd)) Archive(match);
        return outbounds;
    }

    // Saving must never stop the game: a failure is logged and matchEnd still goes out.
    private void Archive(Match match)
    {
        if (_archive == null || match.ToRecord(DateTimeOffset.UtcNow) is not { } record) return;
        try
        {
            _archive.Save(record, match.Id, match.Players.Select(player => player.Id).ToArray());
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Could not save match {match.Id}: {ex.Message}");
        }
    }

    private static IReadOnlyList<Outbound> NotInMatch(string playerId) =>
        new[] { Outbound.Error(playerId, ErrorCodes.NotInMatch, "You are not in a match.") };
}

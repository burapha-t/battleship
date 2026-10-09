using Battleship.Core;
using Battleship.Core.Protocol;
using Battleship.Server.Host;
using Battleship.Server.Lobby;

namespace Battleship.Server.Engine;

/// <summary>
/// One game between two players: PLACING → PLAYING → MATCHEND. Plain
/// synchronous code with no sockets or timers; every call returns the frames
/// to send. Statuses and scores are written to the players' roster records.
/// </summary>
public sealed class Match
{
    private static readonly IReadOnlyList<Outbound> None = Array.Empty<Outbound>();

    private readonly PlayerRecord[] _players;
    private readonly Board?[] _boards = new Board?[2];
    private readonly List<Shot> _moves = new();
    private readonly HashSet<string> _rematchRequests = new();
    private readonly Random _random;

    /// <param name="firstPlayerId">
    /// Who moves first. Null for a first match, which picks at random; a
    /// rematch passes the last winner.
    /// </param>
    public Match(string id, PlayerRecord first, PlayerRecord second, Random random, string? firstPlayerId = null)
    {
        Id = id;
        _players = new[] { first, second };
        _random = random;
        FirstPickedAtRandom = firstPlayerId == null;
        FirstPlayerId = firstPlayerId ?? _players[random.Next(2)].Id;
    }

    public string Id { get; }

    /// <summary>Both players, in the order they're listed in <c>matchStart</c>.</summary>
    public IReadOnlyList<PlayerRecord> Players => _players;

    public MatchPhase Phase { get; private set; } = MatchPhase.Placing;

    public string FirstPlayerId { get; }

    /// <summary>False for a rematch, where the last winner goes first.</summary>
    public bool FirstPickedAtRandom { get; }

    /// <summary>Whose turn it is; null until the first turn.</summary>
    public string? ActivePlayerId { get; private set; }

    /// <summary>0 until the first turn, then 1, 2, ….</summary>
    public int TurnNumber { get; private set; }

    public string? WinnerId { get; private set; }

    /// <summary>Every shot, in order.</summary>
    public IReadOnlyList<Shot> Moves => _moves;

    /// <summary>True once both players have sent <c>rematch</c>.</summary>
    public bool BothWantRematch => _rematchRequests.Count == 2;

    public bool Has(string playerId) => _players[0].Id == playerId || _players[1].Id == playerId;

    /// <summary>Both players go to <c>placing</c> and get <c>matchStart</c>.</summary>
    public IReadOnlyList<Outbound> Start()
    {
        foreach (var player in _players) player.Status = LobbyStatus.Placing;
        return new[] { ToBoth(new MatchStart { MatchId = Id, Players = PlayerInfos(), FirstPlayerId = FirstPlayerId }) };
    }

    /// <summary>
    /// Validates and stores one player's ships. <c>placed</c> carries only the
    /// id. The second placement starts the first turn.
    /// </summary>
    public IReadOnlyList<Outbound> Place(string playerId, IReadOnlyList<IReadOnlyList<Coord>> ships)
    {
        int index = IndexOf(playerId);
        if (Phase != MatchPhase.Placing || _boards[index] != null)
            return Reject(playerId, ErrorCodes.NotInMatch, "You can't place ships now.");

        string? problem = PlacementValidator.Validate(ships);
        if (problem != null) return Reject(playerId, ErrorCodes.InvalidPlacement, problem);

        _boards[index] = new Board(ships.Select(cells => new Ship(cells)).ToList());
        var outbounds = new List<Outbound> { ToBoth(new Placed { Id = playerId }) };
        if (_boards[1 - index] == null) return outbounds;

        Phase = MatchPhase.Playing;
        foreach (var player in _players) player.Status = LobbyStatus.InMatch;
        outbounds.Add(StartTurn(FirstPlayerId));
        return outbounds;
    }

    /// <summary>A shot from a player; errors change nothing.</summary>
    public IReadOnlyList<Outbound> Fire(string playerId, int row, int col)
    {
        if (Phase != MatchPhase.Playing)
            return Reject(playerId, ErrorCodes.NotInMatch, "The match isn't in play.");
        if (playerId != ActivePlayerId)
            return Reject(playerId, ErrorCodes.NotYourTurn, "It is not your turn.");
        if (row < 0 || row >= GameRules.GridSize || col < 0 || col >= GameRules.GridSize)
            return Reject(playerId, ErrorCodes.OutOfRange, $"Row and column must be 0-{GameRules.GridSize - 1}.");

        var cell = new Coord(row, col);
        if (BoardOf(Opponent(playerId).Id).IsShot(cell))
            return Reject(playerId, ErrorCodes.AlreadyFired, "You already fired at that cell.");

        return Shoot(cell, auto: false);
    }

    /// <summary>
    /// The turn timer ran out. If that turn is still current, fires at a
    /// random cell the active player hasn't shot yet; otherwise does nothing.
    /// </summary>
    public IReadOnlyList<Outbound> TurnExpired(int turnNumber)
    {
        if (Phase != MatchPhase.Playing || turnNumber != TurnNumber) return None;

        var board = BoardOf(Opponent(ActivePlayerId!).Id);
        var unshot = new List<Coord>();
        for (int row = 0; row < GameRules.GridSize; row++)
        {
            for (int col = 0; col < GameRules.GridSize; col++)
            {
                if (!board.IsShot(new Coord(row, col))) unshot.Add(new Coord(row, col));
            }
        }

        return Shoot(unshot[_random.Next(unshot.Count)], auto: true);
    }

    /// <summary>
    /// The first request sends <c>rematchPending</c>; a repeat changes
    /// nothing. The second player's request sends nothing here: the engine
    /// sees <see cref="BothWantRematch"/> and starts the new match.
    /// </summary>
    public IReadOnlyList<Outbound> Rematch(string playerId)
    {
        if (Phase != MatchPhase.MatchEnd)
            return Reject(playerId, ErrorCodes.NotInMatch, "There's no finished match to rematch.");
        if (!_rematchRequests.Add(playerId) || BothWantRematch) return None;
        return new[] { ToBoth(new RematchPending { From = playerId }) };
    }

    private IReadOnlyList<Outbound> Shoot(Coord cell, bool auto)
    {
        string by = ActivePlayerId!;
        var target = Opponent(by);
        var result = BoardOf(target.Id).Fire(cell);
        _moves.Add(new Shot(TurnNumber, by, target.Id, cell, result.Hit, auto));

        var outbounds = new List<Outbound>
        {
            ToBoth(new FireResult
            {
                By = by,
                Target = target.Id,
                Row = cell.Row,
                Col = cell.Col,
                Result = result.Hit ? FireResult.Hit : FireResult.Miss,
                Sunk = result.Sunk,
                SunkCells = result.SunkCells,
                AllSunk = result.AllSunk,
                Auto = auto,
            }),
        };

        if (!result.AllSunk)
        {
            outbounds.Add(StartTurn(target.Id));
            return outbounds;
        }

        Phase = MatchPhase.MatchEnd;
        WinnerId = by;
        _players[IndexOf(by)].Score++;
        outbounds.Add(ToBoth(new MatchEnd { MatchId = Id, WinnerId = by, Players = PlayerInfos() }));
        return outbounds;
    }

    private Outbound StartTurn(string playerId)
    {
        ActivePlayerId = playerId;
        TurnNumber++;
        return ToBoth(new Turn { ActivePlayerId = playerId, Seconds = GameRules.TurnSeconds, TurnNumber = TurnNumber });
    }

    private int IndexOf(string playerId) => _players[0].Id == playerId ? 0 : 1;

    private PlayerRecord Opponent(string playerId) => _players[1 - IndexOf(playerId)];

    private Board BoardOf(string playerId) => _boards[IndexOf(playerId)]!;

    private IReadOnlyList<PlayerInfo> PlayerInfos() =>
        _players.Select(player => new PlayerInfo { Id = player.Id, Name = player.Name ?? player.Id, Score = player.Score }).ToList();

    private Outbound ToBoth(ProtocolMessage message) => new(new[] { _players[0].Id, _players[1].Id }, message);

    private static IReadOnlyList<Outbound> Reject(string playerId, string code, string message) =>
        new[] { Outbound.Error(playerId, code, message) };
}

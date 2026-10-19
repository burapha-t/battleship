using System.Threading.Channels;
using Battleship.Core;
using Battleship.Server.Auth;
using Battleship.Core.Protocol;
using Battleship.Server.Dashboard;
using Battleship.Server.Data;
using Battleship.Server.Engine;
using Battleship.Server.Lobby;
using Battleship.Server.Net;

namespace Battleship.Server.Host;

/// <summary>
/// The only code that touches game state (SRV-0). Sessions, the turn timer
/// and the dashboard post <see cref="HostInput"/>s to one channel; one loop
/// handles them in order, sends the resulting frames, then publishes a
/// <see cref="DashboardSnapshot"/>.
/// </summary>
public sealed class GameHost
{
    private readonly GameTickets? _tickets;
    private readonly AccountScores? _scores;
    private readonly string _runId = Guid.NewGuid().ToString("N");
    private const int ActivityKept = 30;

    private readonly Channel<HostInput> _inputs =
        Channel.CreateUnbounded<HostInput>(new UnboundedChannelOptions { SingleReader = true });
    private readonly Dictionary<string, ClientSession> _sessions = new();
    private readonly Roster _roster = new();
    private readonly MatchEngine _engine;
    private readonly DatabaseWorker? _database;
    private readonly GameDatabase? _historyDatabase;
    private readonly List<DashboardEvent> _activity = new();
    private DashboardSnapshot _snapshot = DashboardSnapshot.Empty;

    /// <param name="turnDuration">
    /// How long the turn timer really waits: <c>GameRules.TurnSeconds</c> in
    /// the real server. <c>turn.seconds</c> on the wire is always
    /// <c>GameRules.TurnSeconds</c>.
    /// </param>
    /// <param name="random">First player and auto-fire cell; tests pass a seeded one.</param>
    /// <param name="database">Match history storage; null disables archiving.</param>
    public GameHost(TimeSpan turnDuration, Random random, GameTickets? tickets = null, AccountScores? scores = null, GameDatabase? database = null)
    {
        _tickets = tickets;
        _scores = scores;
        _historyDatabase = database;
        _database = database == null ? null : new DatabaseWorker(database);
        _engine = new MatchEngine(_roster, new TurnTimer(Post, turnDuration), random, _database);
    }

    /// <summary>The latest state for the dashboard, replaced after every input.</summary>
    public DashboardSnapshot Snapshot => Volatile.Read(ref _snapshot);

    /// <summary>Queues an input for the loop. Safe from any thread.</summary>
    public void Post(HostInput input) => _inputs.Writer.TryWrite(input);

    /// <summary>The loop. An input that throws is logged and the loop carries on.</summary>
    public async Task RunAsync(CancellationToken cancellationToken)
    {
        try
        {
            await foreach (var input in _inputs.Reader.ReadAllAsync(cancellationToken))
            {
                try
                {
                    Handle(input);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error handling {input.GetType().Name}: {ex}");
                }
                Volatile.Write(ref _snapshot, BuildSnapshot());
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // Shutting down: let queued saves finish.
        }
        if (_database != null) await _database.CompleteAsync();
    }

    // Whatever changes the roster produces one lobby, sent after the input's
    // other frames (protocol.md §4). RESET always sends one.
    private void Handle(HostInput input)
    {
        string lobbyBefore = ProtocolJson.Serialize(_roster.BuildLobby());

        switch (input)
        {
            case HostInput.Connected connected:
                OnConnected(connected.Session);
                break;
            case HostInput.Message message:
                OnMessage(message.PlayerId, message.Body);
                break;
            case HostInput.Disconnected disconnected:
                OnDisconnected(disconnected.PlayerId);
                break;
            case HostInput.TurnExpired expired:
                Send(_engine.TurnExpired(expired.MatchId, expired.TurnNumber));
                break;
            case HostInput.AccountLoggedOut loggedOut:
                foreach (var player in _roster.Players.Where(p => p.AccountId == loggedOut.AccountId).ToList())
                {
                    player.AuthenticationRejected = true;
                    _sessions[player.Id].Close();
                    OnDisconnected(player.Id);
                }
                break;
            case HostInput.ResetRequested:
                OnReset();
                break;
            case HostInput.DatabaseReply reply:
                Send(new[] { Outbound.ToPlayer(reply.PlayerId, reply.Reply) });
                break;
        }

        string lobbyAfter = ProtocolJson.Serialize(_roster.BuildLobby());
        if (lobbyAfter == lobbyBefore && input is not HostInput.ResetRequested) return;

        SendLine(_roster.Joined.Select(player => player.Id), lobbyAfter);
        Console.WriteLine(_roster.Describe());
    }

    private void OnConnected(ClientSession session)
    {
        _sessions[session.Id] = session;
        _roster.Add(new PlayerRecord(session.Id, session.Address, DateTimeOffset.Now));
        Send(new[] { Outbound.ToPlayer(session.Id, new Connected { Id = session.Id }) });
        Log($"{session.Id} connected from {session.Address}");
    }

    private void OnMessage(string playerId, ProtocolMessage message)
    {
        var player = _roster.Find(playerId);
        if (player == null || player.AuthenticationRejected) return; // its Disconnected was already handled

        switch (message)
        {
            case Authenticate auth:
                OnAuthenticate(player, auth.Ticket);
                break;
            case Join join:
                OnJoin(player, join.Nickname);
                break;
            case FindMatch:
                Send(_engine.FindMatch(playerId));
                break;
            case Place place:
                Send(_engine.Place(playerId, place.Ships));
                break;
            case Fire fire:
                Send(_engine.Fire(playerId, fire.Row, fire.Col));
                break;
            case Rematch:
                Send(_engine.Rematch(playerId));
                break;
            case Leave:
                OnLeave(player);
                break;
            case HistoryList list:
                OnHistoryList(player, list.Page);
                break;
            // A server event sent by a client is ignored, like an unknown type.
        }
    }

    private void OnAuthenticate(PlayerRecord player, string ticket)
    {
        var account = _tickets?.Consume(ticket);
        if (player.HasJoined || player.AccountId is not null || account is null || _scores is null || !_scores.IsValid(account)
            || _roster.Players.Any(other => other.AccountId == account.AccountId))
        {
            player.AuthenticationRejected = true;
            Send(new[] { Outbound.Error(player.Id, "account-unavailable", "Account connection rejected. Close other game tabs and log in again.") });
            return; // No fallback to guest and no later commands on this connection.
        }
        player.Score = _scores.Load(account.AccountId);
        player.MatchesPlayed = _scores.LoadMatchesPlayed(account.AccountId);
        player.AccountId = account.AccountId;
    }

    private void OnJoin(PlayerRecord player, string nickname)
    {
        if (player.HasJoined)
        {
            Send(new[] { Outbound.Error(player.Id, ErrorCodes.Unknown, "You have already joined.") });
            return;
        }

        string? name = NicknamePolicy.Normalize(nickname, _roster.Joined.Select(other => other.Name!));
        if (name == null)
        {
            Send(new[] { Outbound.Error(player.Id, ErrorCodes.BadNickname, $"Nickname must be 1-{NicknamePolicy.MaxLength} characters.") });
            return;
        }

        if (player.AccountId is not null && _historyDatabase is not null)
        {
            try { player.UserId = _historyDatabase.GetOrCreateAccountUser(player.AccountId, name); }
            catch (Exception ex) { Console.WriteLine($"Could not bind match history: {ex.Message}"); }
        }
        player.Name = name;
        player.Status = LobbyStatus.Idle;
        Send(new[] { Outbound.ToPlayer(player.Id, new Welcome { Id = player.Id, Nickname = name, Score = player.Score, MatchesPlayed = player.AccountId is null ? null : player.MatchesPlayed }) });
        Log($"{player.Id} joined as {name}");
    }

    private void OnLeave(PlayerRecord player)
    {
        var match = _engine.Matches.FirstOrDefault(m => m.Has(player.Id) && m.Phase != MatchPhase.Playing);
        Send(_engine.Leave(player.Id));
        if (match != null) Log($"{player.Name} left match {match.Id} for the lobby");
    }

    // Only ever the asking player's own history. A guest (or a server with no
    // database) has none, so gets zeros at once; an account's is read off the loop.
    private void OnHistoryList(PlayerRecord player, int page)
    {
        page = Math.Max(1, page);
        if (player.UserId is not long userId || _database == null)
        {
            Send(new[] { Outbound.ToPlayer(player.Id, new History { Page = page }) });
            return;
        }

        string playerId = player.Id;
        _database.Enqueue(database =>
        {
            ProtocolMessage reply;
            try
            {
                reply = database.GetHistory(userId, page);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Could not read match history for {playerId}: {ex.Message}");
                reply = new Error { Code = ErrorCodes.Unknown, Message = "Match history couldn't be loaded. Try again." };
            }
            Post(new HostInput.DatabaseReply(playerId, reply));
        });
    }

    private void OnDisconnected(string playerId)
    {
        if (!_sessions.Remove(playerId)) return;

        string who = _roster.Find(playerId)?.Name ?? playerId;
        Send(_engine.PlayerLeft(playerId));
        _roster.Remove(playerId);
        Log($"{who} disconnected");
    }

    private void OnReset()
    {
        _scores?.Reset(_roster.Players.Where(p => p.AccountId != null).Select(p => p.AccountId!));
        _engine.Reset();
        Send(new[] { new Outbound(_roster.Joined.Select(player => player.Id).ToList(), new Reset()) });
        Log("RESET from the dashboard: matches ended, scores set to 0");
    }

    private void Send(IEnumerable<Outbound> outbounds)
    {
        foreach (var outbound in outbounds)
        {
            if (outbound.Message is MatchEnd end && _scores is not null)
                _scores.RecordMatch($"{_runId}:{end.MatchId}", _roster.Find(end.WinnerId)?.AccountId,
                    end.Players.Select(p => _roster.Find(p.Id)?.AccountId).OfType<string>());
            SendLine(outbound.To, ProtocolJson.Serialize(outbound.Message));
            Note(outbound.Message);
        }
    }

    // A player who has just disconnected is skipped quietly.
    private void SendLine(IEnumerable<string> playerIds, string line)
    {
        foreach (var playerId in playerIds)
        {
            if (_sessions.TryGetValue(playerId, out var session)) session.Send(line);
        }
    }

    // Match events worth a line in the dashboard's activity log.
    private void Note(ProtocolMessage message)
    {
        switch (message)
        {
            case MatchStart start:
                Log($"Match {start.MatchId}: {start.Players[0].Name} vs {start.Players[1].Name}, {NameOf(start.FirstPlayerId)} goes first");
                break;
            case MatchEnd end:
                Log($"{NameOf(end.WinnerId)} won match {end.MatchId}");
                break;
            case RematchPending pending:
                Log($"{NameOf(pending.From)} asked for a rematch");
                break;
            case FireResult { Auto: true } shot:
                Log($"{NameOf(shot.By)} ran out of time; the server fired for them");
                break;
        }
    }

    private string NameOf(string playerId) => _roster.Find(playerId)?.Name ?? playerId;

    private void Log(string text)
    {
        Console.WriteLine(text);
        _activity.Add(new DashboardEvent(DateTimeOffset.Now, text));
        if (_activity.Count > ActivityKept) _activity.RemoveAt(0);
    }

    private DashboardSnapshot BuildSnapshot() => new(
        _roster.Players.Count,
        _roster.Players
            .Select(p => new DashboardClient(p.Id, p.Name, p.Address, p.Status, p.Score, p.ConnectedAt, p.AccountId, p.MatchesPlayed))
            .ToList(),
        _engine.Matches
            .Select(m => new DashboardMatch(
                m.Id,
                m.Phase.ToString(),
                m.Players.Select(p => new DashboardPlayer(p.Id, p.Name, p.Score)).ToList(),
                m.FirstPlayerId,
                m.FirstPickedAtRandom,
                m.ActivePlayerId,
                m.TurnNumber,
                m.WinnerId))
            .ToList(),
        _activity.AsEnumerable().Reverse().ToList());
}

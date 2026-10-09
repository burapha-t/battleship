using System.Threading.Channels;
using Battleship.Core;
using Battleship.Core.Protocol;
using Battleship.Server.Dashboard;
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
    private const int ActivityKept = 30;

    private readonly Channel<HostInput> _inputs =
        Channel.CreateUnbounded<HostInput>(new UnboundedChannelOptions { SingleReader = true });
    private readonly Dictionary<string, ClientSession> _sessions = new();
    private readonly Roster _roster = new();
    private readonly MatchEngine _engine;
    private readonly List<DashboardEvent> _activity = new();
    private DashboardSnapshot _snapshot = DashboardSnapshot.Empty;

    /// <param name="turnDuration">
    /// How long the turn timer really waits: <c>GameRules.TurnSeconds</c> in
    /// the real server. <c>turn.seconds</c> on the wire is always
    /// <c>GameRules.TurnSeconds</c>.
    /// </param>
    /// <param name="random">First player and auto-fire cell; tests pass a seeded one.</param>
    public GameHost(TimeSpan turnDuration, Random random)
    {
        _engine = new MatchEngine(_roster, new TurnTimer(Post, turnDuration), random);
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
                    Console.WriteLine($"Error handling {input}: {ex}");
                }
                Volatile.Write(ref _snapshot, BuildSnapshot());
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // Shutting down.
        }
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
            case HostInput.ResetRequested:
                OnReset();
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
        if (player == null) return; // its Disconnected was already handled

        switch (message)
        {
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
            // A server event sent by a client is ignored, like an unknown type.
        }
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

        player.Name = name;
        player.Status = LobbyStatus.Idle;
        Send(new[] { Outbound.ToPlayer(player.Id, new Welcome { Id = player.Id, Nickname = name }) });
        Log($"{player.Id} joined as {name}");
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
        _engine.Reset();
        Send(new[] { new Outbound(_roster.Joined.Select(player => player.Id).ToList(), new Reset()) });
        Log("RESET from the dashboard: matches ended, scores set to 0");
    }

    private void Send(IEnumerable<Outbound> outbounds)
    {
        foreach (var outbound in outbounds)
        {
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
            .Select(p => new DashboardClient(p.Id, p.Name, p.Address, p.Status, p.Score, p.ConnectedAt))
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

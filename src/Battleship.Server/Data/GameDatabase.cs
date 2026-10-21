using System.Globalization;
using Battleship.Core;
using Battleship.Core.Protocol;
using Microsoft.Data.Sqlite;

namespace Battleship.Server.Data;

/// <summary>One saved account. <c>Avatar</c> stays null until a picture is chosen.</summary>
public sealed record UserRecord(
    long Id, string Username, byte[] Salt, byte[] Hash, int Iterations, string? Avatar, DateTimeOffset CreatedAt);

/// <summary>One player's side of a finished match: who they are and where their ships were.</summary>
public sealed record MatchPlayerRecord(long UserId, IReadOnlyList<IReadOnlyList<Coord>> Fleet);

/// <summary>One shot, as <c>Match.Moves</c> logs it but with user ids.</summary>
public sealed record ShotRecord(int Turn, long ByUserId, Coord Cell, bool Hit, bool Auto);

/// <summary>Everything about a finished match that <see cref="GameDatabase.SaveMatch"/> stores.</summary>
public sealed record MatchRecord(
    DateTimeOffset StartedAt,
    DateTimeOffset EndedAt,
    long WinnerId,
    IReadOnlyList<MatchPlayerRecord> Players,
    IReadOnlyList<ShotRecord> Shots);

/// <summary>
/// The SQLite file that holds accounts and finished matches. Only the server
/// opens it. It stores raw facts (matches, shots, fleets); stats such as win
/// rate and accuracy are worked out with queries. Each call opens its own
/// connection, so the class keeps no open handle. Tables and rules:
/// docs/implement/database.md.
/// </summary>
public sealed class GameDatabase
{
    public const int SchemaVersion = 2;

    private const string Schema = """
        CREATE TABLE IF NOT EXISTS users (
            id          INTEGER PRIMARY KEY,
            username    TEXT    NOT NULL UNIQUE COLLATE NOCASE,
            salt        BLOB    NOT NULL,
            hash        BLOB    NOT NULL,
            iterations  INTEGER NOT NULL,
            avatar      TEXT,
            created_at  TEXT    NOT NULL);

        CREATE TABLE IF NOT EXISTS matches (
            id          INTEGER PRIMARY KEY,
            started_at  TEXT    NOT NULL,
            ended_at    TEXT    NOT NULL,
            winner_id   INTEGER NOT NULL REFERENCES users(id));

        CREATE TABLE IF NOT EXISTS match_players (
            match_id      INTEGER NOT NULL REFERENCES matches(id),
            user_id       INTEGER NOT NULL REFERENCES users(id),
            opponent_name TEXT    NOT NULL,
            won           INTEGER NOT NULL,
            shots         INTEGER NOT NULL,
            hits          INTEGER NOT NULL,
            best_streak   INTEGER NOT NULL,
            PRIMARY KEY (match_id, user_id));
        CREATE INDEX IF NOT EXISTS match_players_by_user ON match_players(user_id);

        CREATE TABLE IF NOT EXISTS shots (
            match_id    INTEGER NOT NULL REFERENCES matches(id),
            turn        INTEGER NOT NULL,
            by_user_id  INTEGER NOT NULL REFERENCES users(id),
            "row"       INTEGER NOT NULL,
            col         INTEGER NOT NULL,
            hit         INTEGER NOT NULL,
            auto        INTEGER NOT NULL,
            PRIMARY KEY (match_id, turn));

        CREATE TABLE IF NOT EXISTS fleets (
            match_id    INTEGER NOT NULL,
            user_id     INTEGER NOT NULL,
            ship        INTEGER NOT NULL,
            "row"       INTEGER NOT NULL,
            col         INTEGER NOT NULL,
            PRIMARY KEY (match_id, user_id, "row", col),
            FOREIGN KEY (match_id, user_id) REFERENCES match_players(match_id, user_id));

        CREATE TABLE IF NOT EXISTS achievements (
            user_id     INTEGER NOT NULL REFERENCES users(id),
            code        TEXT    NOT NULL,
            unlocked_at TEXT    NOT NULL,
            match_id    INTEGER NOT NULL REFERENCES matches(id),
            PRIMARY KEY (user_id, code));
        """;

    private readonly string _connectionString;

    /// <summary>Opens the file at <paramref name="path"/>, creating it and any missing table.</summary>
    public GameDatabase(string path)
    {
        Path = path;
        var folder = System.IO.Path.GetDirectoryName(System.IO.Path.GetFullPath(path));
        if (!string.IsNullOrEmpty(folder)) Directory.CreateDirectory(folder);
        _connectionString = new SqliteConnectionStringBuilder { DataSource = path, ForeignKeys = true }.ToString();

        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        long found;
        using (var version = Command(connection, transaction, "PRAGMA user_version;"))
            found = (long)version.ExecuteScalar()!;
        if (found > SchemaVersion)
            throw new InvalidOperationException(
                $"{path} was made by a newer server (schema {found}; this one knows {SchemaVersion}).");

        // One step per version, oldest first; a new file runs them all. Schema is
        // version 1, so leave it as is: to change a table, raise SchemaVersion and
        // add "if (found < N) { ALTER ... }" below. Version 2: shown badges (#42).
        if (found < 1) Execute(connection, transaction, Schema);
        if (found < 2) Execute(connection, transaction,
            "ALTER TABLE users ADD COLUMN shown_badges TEXT NOT NULL DEFAULT '';");
        Execute(connection, transaction, $"PRAGMA user_version = {SchemaVersion};");
        transaction.Commit();
    }

    public string Path { get; }

    /// <summary>
    /// <c>battleship/battleship.db</c> in the host's app-data folder. Not beside
    /// the server program: <c>scripts/publish.*</c> deletes that folder on every run.
    /// </summary>
    public static string DefaultPath()
    {
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        if (string.IsNullOrEmpty(appData)) appData = AppContext.BaseDirectory;
        return System.IO.Path.Combine(appData, "battleship", "battleship.db");
    }

    /// <summary>Adds an account. Returns its id, or null when the name is taken, ignoring case.</summary>
    public long? CreateUser(string username, byte[] salt, byte[] hash, int iterations)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO users (username, salt, hash, iterations, created_at)
            VALUES ($username, $salt, $hash, $iterations, $createdAt)
            RETURNING id;
            """;
        command.Parameters.AddWithValue("$username", username);
        command.Parameters.AddWithValue("$salt", salt);
        command.Parameters.AddWithValue("$hash", hash);
        command.Parameters.AddWithValue("$iterations", iterations);
        command.Parameters.AddWithValue("$createdAt", Format(DateTimeOffset.UtcNow));
        try
        {
            return (long)command.ExecuteScalar()!;
        }
        catch (SqliteException ex) when (ex.SqliteExtendedErrorCode == 2067) // SQLITE_CONSTRAINT_UNIQUE
        {
            return null;
        }
    }

    /// <summary>The account with this name, ignoring case, or null.</summary>
    public UserRecord? FindUser(string username)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT id, username, salt, hash, iterations, avatar, created_at
            FROM users WHERE username = $username;
            """;
        command.Parameters.AddWithValue("$username", username);
        using var reader = command.ExecuteReader();
        if (!reader.Read()) return null;
        return new UserRecord(
            reader.GetInt64(0),
            reader.GetString(1),
            (byte[])reader[2],
            (byte[])reader[3],
            reader.GetInt32(4),
            reader.IsDBNull(5) ? null : reader.GetString(5),
            DateTimeOffset.Parse(reader.GetString(6), CultureInfo.InvariantCulture));
    }

    /// <summary>
    /// Stores a finished match: the match, both players, every shot and both
    /// fleets, in one transaction, so a failure leaves nothing behind. Each
    /// player's shots, hits and best hit streak are counted here from the shots.
    /// Returns the new match id.
    /// </summary>
    public long SaveMatch(MatchRecord match)
    {
        if (match.Players.Count != 2)
            throw new ArgumentException("A match has exactly two players.", nameof(match));
        if (match.Players[0].UserId == match.Players[1].UserId)
            throw new ArgumentException("The two players must be different users.", nameof(match));
        if (match.Players.All(p => p.UserId != match.WinnerId))
            throw new ArgumentException("The winner must be one of the players.", nameof(match));
        if (match.Shots.Any(s => match.Players.All(p => p.UserId != s.ByUserId)))
            throw new ArgumentException("Every shot must be fired by one of the players.", nameof(match));

        using var connection = Open();
        using var transaction = connection.BeginTransaction();

        long matchId;
        using (var command = Command(connection, transaction, """
            INSERT INTO matches (started_at, ended_at, winner_id)
            VALUES ($startedAt, $endedAt, $winnerId)
            RETURNING id;
            """))
        {
            command.Parameters.AddWithValue("$startedAt", Format(match.StartedAt));
            command.Parameters.AddWithValue("$endedAt", Format(match.EndedAt));
            command.Parameters.AddWithValue("$winnerId", match.WinnerId);
            matchId = (long)command.ExecuteScalar()!;
        }

        for (int i = 0; i < 2; i++)
        {
            var player = match.Players[i];
            var opponent = match.Players[1 - i];
            var own = match.Shots.Where(s => s.ByUserId == player.UserId).OrderBy(s => s.Turn).ToList();

            using (var command = Command(connection, transaction, """
                INSERT INTO match_players (match_id, user_id, opponent_name, won, shots, hits, best_streak)
                VALUES ($matchId, $userId,
                        (SELECT username FROM users WHERE id = $opponentId),
                        $won, $shots, $hits, $bestStreak);
                """))
            {
                command.Parameters.AddWithValue("$matchId", matchId);
                command.Parameters.AddWithValue("$userId", player.UserId);
                command.Parameters.AddWithValue("$opponentId", opponent.UserId);
                command.Parameters.AddWithValue("$won", player.UserId == match.WinnerId);
                command.Parameters.AddWithValue("$shots", own.Count);
                command.Parameters.AddWithValue("$hits", own.Count(s => s.Hit));
                command.Parameters.AddWithValue("$bestStreak", BestStreak(own));
                command.ExecuteNonQuery();
            }

            for (int ship = 0; ship < player.Fleet.Count; ship++)
            {
                foreach (var cell in player.Fleet[ship])
                {
                    using var command = Command(connection, transaction, """
                        INSERT INTO fleets (match_id, user_id, ship, "row", col)
                        VALUES ($matchId, $userId, $ship, $row, $col);
                        """);
                    command.Parameters.AddWithValue("$matchId", matchId);
                    command.Parameters.AddWithValue("$userId", player.UserId);
                    command.Parameters.AddWithValue("$ship", ship);
                    command.Parameters.AddWithValue("$row", cell.Row);
                    command.Parameters.AddWithValue("$col", cell.Col);
                    command.ExecuteNonQuery();
                }
            }
        }

        foreach (var shot in match.Shots)
        {
            using var command = Command(connection, transaction, """
                INSERT INTO shots (match_id, turn, by_user_id, "row", col, hit, auto)
                VALUES ($matchId, $turn, $byUserId, $row, $col, $hit, $auto);
                """);
            command.Parameters.AddWithValue("$matchId", matchId);
            command.Parameters.AddWithValue("$turn", shot.Turn);
            command.Parameters.AddWithValue("$byUserId", shot.ByUserId);
            command.Parameters.AddWithValue("$row", shot.Cell.Row);
            command.Parameters.AddWithValue("$col", shot.Cell.Col);
            command.Parameters.AddWithValue("$hit", shot.Hit);
            command.Parameters.AddWithValue("$auto", shot.Auto);
            command.ExecuteNonQuery();
        }

        transaction.Commit();
        return matchId;
    }

    /// <summary>
    /// One page of a player's match history (HIST-1): totals over all their
    /// matches, and <see cref="History.PageSize"/> matches, newest first.
    /// Page 1 is the newest; a page below 1 counts as 1. A player with no
    /// matches gets zeros. Every shot counts toward accuracy, timeout shots
    /// included (database.md rule 7).
    /// </summary>
    public History GetHistory(long userId, int page)
    {
        page = Math.Max(1, page);
        using var connection = Open();

        var stats = new HistoryStats();
        using (var command = connection.CreateCommand())
        {
            command.CommandText = """
                SELECT COUNT(*), COALESCE(SUM(won), 0), COALESCE(SUM(hits), 0), COALESCE(SUM(shots), 0)
                FROM match_players WHERE user_id = $userId;
                """;
            command.Parameters.AddWithValue("$userId", userId);
            using var reader = command.ExecuteReader();
            reader.Read();
            stats.MatchCount = reader.GetInt32(0);
            stats.WinCount = reader.GetInt32(1);
            stats.LoseCount = stats.MatchCount - stats.WinCount;
            stats.WinRate = Percent(stats.WinCount, stats.MatchCount);
            stats.Accuracy = Percent(reader.GetInt64(2), reader.GetInt64(3));
        }

        // One extra row tells whether an older page exists.
        var matches = new List<HistoryMatch>();
        using (var command = connection.CreateCommand())
        {
            command.CommandText = """
                SELECT mp.won, mp.opponent_name, m.ended_at, mp.hits, mp.shots
                FROM match_players mp JOIN matches m ON m.id = mp.match_id
                WHERE mp.user_id = $userId
                ORDER BY m.ended_at DESC, m.id DESC
                LIMIT $limit OFFSET $offset;
                """;
            command.Parameters.AddWithValue("$userId", userId);
            command.Parameters.AddWithValue("$limit", History.PageSize + 1);
            command.Parameters.AddWithValue("$offset", (long)(page - 1) * History.PageSize);
            using var reader = command.ExecuteReader();
            while (reader.Read())
            {
                matches.Add(new HistoryMatch
                {
                    Won = reader.GetInt64(0) == 1,
                    Opponent = reader.GetString(1),
                    EndedAt = DateTimeOffset.Parse(reader.GetString(2), CultureInfo.InvariantCulture)
                        .ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture),
                    Accuracy = Percent(reader.GetInt64(3), reader.GetInt64(4)),
                });
            }
        }

        bool more = matches.Count > History.PageSize;
        if (more) matches.RemoveAt(History.PageSize);
        return new History { Page = page, Stats = stats, Matches = matches, More = more };
    }

    /// <summary>
    /// The all-time leaderboard (LB-1): every account with a saved match,
    /// ranked by points (wins), then accuracy, then name A–Z. Players tied on
    /// points and accuracy as sent (one decimal) share a rank: 1, 1, 3. Every
    /// shot counts toward accuracy, timeout shots included. At most
    /// <see cref="Leaderboard.MaxRows"/> rows.
    /// </summary>
    public Leaderboard GetLeaderboard()
    {
        using var connection = Open();
        return new Leaderboard { Rows = RankAll(connection).Take(Leaderboard.MaxRows).Select(r => r.Row).ToList() };
    }

    /// <summary>
    /// Every account with a saved match, ranked as on the leaderboard, with
    /// its user id. Shared by <see cref="GetLeaderboard"/> and <see cref="GetProfile"/>.
    /// </summary>
    private static List<(long UserId, LeaderboardRow Row)> RankAll(SqliteConnection connection)
    {
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT u.id, u.username, SUM(mp.won), SUM(mp.hits), SUM(mp.shots)
            FROM match_players mp JOIN users u ON u.id = mp.user_id
            GROUP BY u.id;
            """;

        var players = new List<(long UserId, LeaderboardRow Row)>();
        using (var reader = command.ExecuteReader())
        {
            while (reader.Read())
            {
                players.Add((reader.GetInt64(0), new LeaderboardRow
                {
                    Name = reader.GetString(1),
                    Points = reader.GetInt32(2),
                    Accuracy = Percent(reader.GetInt64(3), reader.GetInt64(4)),
                }));
            }
        }

        var ranked = players
            .OrderByDescending(p => p.Row.Points)
            .ThenByDescending(p => p.Row.Accuracy)
            .ThenBy(p => p.Row.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();
        for (int i = 0; i < ranked.Count; i++)
        {
            var row = ranked[i].Row;
            var above = i > 0 ? ranked[i - 1].Row : null;
            bool tied = above != null && row.Points == above.Points && row.Accuracy == above.Accuracy;
            row.Rank = tied ? above!.Rank : i + 1;
        }
        return ranked;
    }

    /// <summary>
    /// Badges (#41): checks one saved match against <see cref="Achievements"/>
    /// and stores each badge the player doesn't own yet, unlocked by that
    /// match. Wins count every saved match; accuracy and streak only this one.
    /// Returns only the new badges, in catalogue order.
    /// </summary>
    public IReadOnlyList<BadgeUnlock> UnlockAchievements(long userId, long matchId, DateTimeOffset unlockedAt)
    {
        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        IReadOnlyList<string> earned;
        using (var command = Command(connection, transaction, """
            SELECT (SELECT COALESCE(SUM(won), 0) FROM match_players WHERE user_id = $userId),
                   shots, hits, best_streak
            FROM match_players WHERE user_id = $userId AND match_id = $matchId;
            """))
        {
            command.Parameters.AddWithValue("$userId", userId);
            command.Parameters.AddWithValue("$matchId", matchId);
            using var reader = command.ExecuteReader();
            if (!reader.Read()) return Array.Empty<BadgeUnlock>();
            earned = Achievements.Earned(reader.GetInt32(0), reader.GetInt32(1), reader.GetInt32(2), reader.GetInt32(3));
        }

        var result = new List<BadgeUnlock>();
        foreach (var code in earned)
        {
            using var command = Command(connection, transaction, """
                INSERT OR IGNORE INTO achievements (user_id, code, unlocked_at, match_id)
                VALUES ($userId, $code, $time, $matchId);
                """);
            command.Parameters.AddWithValue("$userId", userId);
            command.Parameters.AddWithValue("$code", code);
            command.Parameters.AddWithValue("$time", Format(unlockedAt));
            command.Parameters.AddWithValue("$matchId", matchId);
            if (command.ExecuteNonQuery() == 1) result.Add(new BadgeUnlock { Code = code, UnlockedAt = WireTime(unlockedAt) });
        }
        transaction.Commit();
        return result;
    }

    /// <summary>
    /// One player's badges, oldest first (badges from one match in catalogue
    /// order), and the stats they're earned from: total wins, best single-match
    /// accuracy and best streak (#41). A player with no matches gets zeros.
    /// </summary>
    public AchievementList GetAchievements(long userId)
    {
        using var connection = Open();
        var list = new AchievementList();
        using (var command = connection.CreateCommand())
        {
            command.CommandText = """
                SELECT COALESCE(SUM(won), 0), COALESCE(MAX(100.0 * hits / NULLIF(shots, 0)), 0),
                       COALESCE(MAX(best_streak), 0)
                FROM match_players WHERE user_id = $userId;
                """;
            command.Parameters.AddWithValue("$userId", userId);
            using var reader = command.ExecuteReader();
            reader.Read();
            list.Wins = reader.GetInt32(0);
            list.BestAccuracy = Math.Round(reader.GetDouble(1), 1, MidpointRounding.AwayFromZero);
            list.BestStreak = reader.GetInt32(2);
        }

        var badges = new List<BadgeUnlock>();
        using (var command = connection.CreateCommand())
        {
            command.CommandText = "SELECT code, unlocked_at FROM achievements WHERE user_id = $userId;";
            command.Parameters.AddWithValue("$userId", userId);
            using var reader = command.ExecuteReader();
            while (reader.Read())
            {
                badges.Add(new BadgeUnlock
                {
                    Code = reader.GetString(0),
                    UnlockedAt = WireTime(DateTimeOffset.Parse(reader.GetString(1), CultureInfo.InvariantCulture)),
                });
            }
        }
        var catalogue = Achievements.Catalogue.ToList();
        list.Badges = badges
            .OrderBy(b => b.UnlockedAt, StringComparer.Ordinal)
            .ThenBy(b => catalogue.IndexOf(b.Code))
            .ToList();
        return list;
    }

    /// <summary>
    /// One player's profile (#42): picture ("" for none), shown badges in
    /// their order, leaderboard rank over every account (null with no saved
    /// match) and total wins. Throws if the account doesn't exist.
    /// </summary>
    public Profile GetProfile(long userId)
    {
        using var connection = Open();
        var profile = new Profile();
        using (var command = connection.CreateCommand())
        {
            command.CommandText = """
                SELECT COALESCE(avatar, ''), shown_badges,
                       (SELECT COALESCE(SUM(won), 0) FROM match_players WHERE user_id = $userId)
                FROM users WHERE id = $userId;
                """;
            command.Parameters.AddWithValue("$userId", userId);
            using var reader = command.ExecuteReader();
            if (!reader.Read()) throw new InvalidOperationException($"Account {userId} doesn't exist.");
            profile.Avatar = reader.GetString(0);
            profile.ShownBadges = reader.GetString(1).Split(',', StringSplitOptions.RemoveEmptyEntries);
            profile.Wins = reader.GetInt32(2);
        }
        profile.Rank = RankAll(connection).Where(r => r.UserId == userId).Select(r => (int?)r.Row.Rank).FirstOrDefault();
        return profile;
    }

    /// <summary>
    /// Saves a player's picture and shown badges together (#42). The picture is
    /// "" or in <see cref="Avatars.Catalogue"/>; at most 3 badges, no repeats,
    /// each one the player owns. Anything else throws ArgumentException, whose
    /// message is safe to show, and saves nothing.
    /// </summary>
    public void SetProfile(long userId, string? avatar, IReadOnlyList<string>? shownBadges)
    {
        if (avatar == null || (avatar != "" && !Avatars.Catalogue.Contains(avatar)))
            throw new ArgumentException("Choose one of the profile pictures.");
        if (shownBadges == null)
            throw new ArgumentException("Say which badges to show.");
        if (shownBadges.Count > 3)
            throw new ArgumentException("Choose at most 3 badges to show.");
        if (shownBadges.Distinct(StringComparer.Ordinal).Count() != shownBadges.Count)
            throw new ArgumentException("Each badge can be shown only once.");
        if (shownBadges.Any(code => !Achievements.Catalogue.Contains(code)))
            throw new ArgumentException("That badge doesn't exist.");

        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        foreach (var code in shownBadges)
        {
            using var owned = Command(connection, transaction,
                "SELECT COUNT(*) FROM achievements WHERE user_id = $userId AND code = $code;");
            owned.Parameters.AddWithValue("$userId", userId);
            owned.Parameters.AddWithValue("$code", code);
            if ((long)owned.ExecuteScalar()! == 0)
                throw new ArgumentException("You can only show badges you have earned.");
        }
        using (var command = Command(connection, transaction,
            "UPDATE users SET avatar = $avatar, shown_badges = $badges WHERE id = $userId;"))
        {
            command.Parameters.AddWithValue("$userId", userId);
            command.Parameters.AddWithValue("$avatar", avatar);
            command.Parameters.AddWithValue("$badges", string.Join(",", shownBadges));
            if (command.ExecuteNonQuery() != 1)
                throw new InvalidOperationException($"Account {userId} doesn't exist.");
        }
        transaction.Commit();
    }

    /// <summary>part / whole as a percentage with one decimal; 0 when whole is 0.</summary>
    private static double Percent(long part, long whole) =>
        whole == 0 ? 0 : Math.Round(100.0 * part / whole, 1, MidpointRounding.AwayFromZero);

    /// <summary>The longest run of hits in a row among one player's shots, in turn order.</summary>
    private static int BestStreak(IEnumerable<ShotRecord> shots)
    {
        int best = 0, current = 0;
        foreach (var shot in shots)
        {
            current = shot.Hit ? current + 1 : 0;
            best = Math.Max(best, current);
        }
        return best;
    }

    private SqliteConnection Open()
    {
        var connection = new SqliteConnection(_connectionString);
        connection.Open();
        return connection;
    }

    private static SqliteCommand Command(SqliteConnection connection, SqliteTransaction transaction, string sql)
    {
        var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = sql;
        return command;
    }

    private static void Execute(SqliteConnection connection, SqliteTransaction transaction, string sql)
    {
        using var command = Command(connection, transaction, sql);
        command.ExecuteNonQuery();
    }

    /// <summary>Times are stored as ISO 8601 text in UTC, which sorts correctly as text.</summary>
    private static string Format(DateTimeOffset time) =>
        time.ToUniversalTime().ToString("o", CultureInfo.InvariantCulture);

    /// <summary>Times on the wire: UTC to the second, e.g. 2026-10-19T07:00:00Z.</summary>
    private static string WireTime(DateTimeOffset time) =>
        time.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture);
}

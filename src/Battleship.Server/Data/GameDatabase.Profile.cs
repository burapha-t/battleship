using System.Globalization;
using Battleship.Core;
using Battleship.Core.Protocol;

namespace Battleship.Server.Data;

// Own profile (#42) and badges (#41). Called only by DatabaseWorker.
public sealed partial class GameDatabase
{
    public Profile GetProfile(long userId)
    {
        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        var profile = new Profile();
        using (var command = Command(connection, transaction,
            "SELECT COALESCE(avatar, ''), shown_badges FROM users WHERE id = $userId;"))
        {
            command.Parameters.AddWithValue("$userId", userId);
            using var reader = command.ExecuteReader();
            if (!reader.Read()) throw new InvalidOperationException("Account no longer exists.");
            profile.Avatar = reader.GetString(0);
            profile.ShownBadges = reader.GetString(1).Split(',', StringSplitOptions.RemoveEmptyEntries);
        }
        using (var command = Command(connection, transaction, """
            SELECT COALESCE(SUM(won), 0), COALESCE(MAX(100.0 * hits / NULLIF(shots, 0)), 0),
                   COALESCE(MAX(best_streak), 0)
            FROM match_players WHERE user_id = $userId;
            """))
        {
            command.Parameters.AddWithValue("$userId", userId);
            using var reader = command.ExecuteReader();
            reader.Read();
            profile.Wins = reader.GetInt32(0);
            profile.BestAccuracy = Math.Round(reader.GetDouble(1), 1, MidpointRounding.AwayFromZero);
            profile.BestStreak = reader.GetInt32(2);
        }
        var badges = new List<BadgeUnlock>();
        using (var command = Command(connection, transaction,
            "SELECT code, unlocked_at FROM achievements WHERE user_id = $userId ORDER BY unlocked_at, rowid;"))
        {
            command.Parameters.AddWithValue("$userId", userId);
            using var reader = command.ExecuteReader();
            while (reader.Read()) badges.Add(new BadgeUnlock { Code = reader.GetString(0),
                UnlockedAt = DateTimeOffset.Parse(reader.GetString(1), CultureInfo.InvariantCulture)
                    .ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture) });
        }
        profile.Badges = badges;
        transaction.Commit();
        return profile;
    }

    /// <summary>Validate ownership and update both choices atomically (#42).</summary>
    public void SetProfile(long userId, string? avatar, IReadOnlyList<string>? shownBadges)
    {
        if (avatar == null || (avatar != "" && !Avatars.Catalogue.Contains(avatar)))
            throw new ArgumentException("Choose a valid profile picture.");
        if (shownBadges == null || shownBadges.Count > 3)
            throw new ArgumentException("Choose at most three badges.");
        if (shownBadges.Distinct(StringComparer.Ordinal).Count() != shownBadges.Count)
            throw new ArgumentException("Each shown badge must be different.");
        if (shownBadges.Any(code => !Achievements.Catalogue.Contains(code)))
            throw new ArgumentException("Unknown badge code.");
        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        foreach (var code in shownBadges)
        {
            using var owned = Command(connection, transaction,
                "SELECT COUNT(*) FROM achievements WHERE user_id = $userId AND code = $code;");
            owned.Parameters.AddWithValue("$userId", userId);
            owned.Parameters.AddWithValue("$code", code);
            if ((long)owned.ExecuteScalar()! == 0) throw new ArgumentException("You can only show badges you have earned.");
        }
        using (var command = Command(connection, transaction,
            "UPDATE users SET avatar = $avatar, shown_badges = $badges WHERE id = $userId;"))
        {
            command.Parameters.AddWithValue("$userId", userId);
            command.Parameters.AddWithValue("$avatar", avatar);
            command.Parameters.AddWithValue("$badges", string.Join(",", shownBadges));
            if (command.ExecuteNonQuery() != 1) throw new InvalidOperationException("Account no longer exists.");
        }
        transaction.Commit();
    }

    /// <summary>Return only newly inserted badges for this saved match and account (#41).</summary>
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
        var time = unlockedAt.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture);
        foreach (var code in earned)
        {
            using var command = Command(connection, transaction, """
                INSERT OR IGNORE INTO achievements (user_id, code, unlocked_at, match_id)
                VALUES ($userId, $code, $time, $matchId);
                """);
            command.Parameters.AddWithValue("$userId", userId);
            command.Parameters.AddWithValue("$code", code);
            command.Parameters.AddWithValue("$time", time);
            command.Parameters.AddWithValue("$matchId", matchId);
            if (command.ExecuteNonQuery() == 1) result.Add(new BadgeUnlock { Code = code, UnlockedAt = time });
        }
        transaction.Commit();
        return result;
    }
}

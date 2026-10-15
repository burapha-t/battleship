using Microsoft.Data.Sqlite;

namespace Battleship.Server.Auth;

/// <summary>Additive SQLite schema; never replaces or modifies existing Identity accounts.</summary>
public sealed class AccountScores(string databasePath)
{
    private SqliteConnection Open()
    {
        var connection = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = databasePath, ForeignKeys = true }.ToString());
        connection.Open();
        return connection;
    }

    public void Initialize()
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE IF NOT EXISTS AccountScores (
                AccountId TEXT PRIMARY KEY REFERENCES AspNetUsers(Id) ON DELETE CASCADE,
                Score INTEGER NOT NULL DEFAULT 0 CHECK (Score >= 0));
            CREATE TABLE IF NOT EXISTS AccountMatchTotals (
                AccountId TEXT PRIMARY KEY REFERENCES AspNetUsers(Id) ON DELETE CASCADE,
                MatchesPlayed INTEGER NOT NULL DEFAULT 0 CHECK (MatchesPlayed >= 0));
            CREATE TABLE IF NOT EXISTS RecordedMatches (
                MatchKey TEXT NOT NULL,
                AccountId TEXT NOT NULL REFERENCES AspNetUsers(Id) ON DELETE CASCADE,
                PRIMARY KEY (MatchKey, AccountId));
            """;
        command.ExecuteNonQuery();
    }

    public bool IsValid(GameTickets.Entry entry)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT COUNT(*) FROM AspNetUsers WHERE Id = $id AND SecurityStamp = $stamp";
        command.Parameters.AddWithValue("$id", entry.AccountId);
        command.Parameters.AddWithValue("$stamp", entry.SecurityStamp);
        return Convert.ToInt32(command.ExecuteScalar()) == 1;
    }

    public int Load(string accountId)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT Score FROM AccountScores WHERE AccountId = $id";
        command.Parameters.AddWithValue("$id", accountId);
        return Convert.ToInt32(command.ExecuteScalar() ?? 0);
    }

    public int LoadMatchesPlayed(string accountId)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT MatchesPlayed FROM AccountMatchTotals WHERE AccountId = $id";
        command.Parameters.AddWithValue("$id", accountId);
        return Convert.ToInt32(command.ExecuteScalar() ?? 0);
    }

    // Both players' statistics and deduplication commit in one transaction.
    public void RecordMatch(string matchKey, string? winnerAccountId, IEnumerable<string> accountIds)
    {
        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        foreach (var id in accountIds.Distinct())
        {
            using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = "INSERT OR IGNORE INTO RecordedMatches (MatchKey, AccountId) VALUES ($match, $id)";
            command.Parameters.AddWithValue("$match", matchKey);
            command.Parameters.AddWithValue("$id", id);
            if (command.ExecuteNonQuery() == 0) continue;
            command.CommandText = "INSERT INTO AccountMatchTotals (AccountId, MatchesPlayed) VALUES ($id, 1) ON CONFLICT(AccountId) DO UPDATE SET MatchesPlayed = MatchesPlayed + 1";
            command.ExecuteNonQuery();
            if (id == winnerAccountId)
            {
                command.CommandText = "INSERT INTO AccountScores (AccountId, Score) VALUES ($id, 1) ON CONFLICT(AccountId) DO UPDATE SET Score = Score + 1";
                command.ExecuteNonQuery();
            }
        }
        transaction.Commit();
    }

    public void Reset(IEnumerable<string> accountIds)
    {
        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        foreach (var id in accountIds.Distinct())
        {
            using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = "UPDATE AccountScores SET Score = 0 WHERE AccountId = $id";
            command.Parameters.AddWithValue("$id", id);
            command.ExecuteNonQuery();
        }
        transaction.Commit();
    }
}

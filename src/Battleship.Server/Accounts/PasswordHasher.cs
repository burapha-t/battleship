using System.Security.Cryptography;

namespace Battleship.Server.Accounts;

/// <summary>
/// Salted PBKDF2-HMAC-SHA256 password hashes (LOGIN-1). Slow on purpose, so it
/// runs in a <c>DatabaseWorker</c> job, never on the game loop. Each account
/// keeps the iteration count it was hashed with (<c>users.iterations</c>).
/// </summary>
public sealed class PasswordHasher
{
    public const int DefaultIterations = 600_000;
    public const int SaltBytes = 16;
    public const int HashBytes = 32;

    /// <param name="iterations">For new hashes; tests pass a low one.</param>
    public PasswordHasher(int iterations = DefaultIterations)
    {
        if (iterations < 1) throw new ArgumentOutOfRangeException(nameof(iterations));
        Iterations = iterations;
    }

    public int Iterations { get; }

    /// <summary>A new random salt and the password's hash with it, at <see cref="Iterations"/>.</summary>
    public (byte[] Salt, byte[] Hash) Hash(string password)
    {
        byte[] salt = RandomNumberGenerator.GetBytes(SaltBytes);
        return (salt, Derive(password, salt, Iterations));
    }

    /// <summary>True when <paramref name="password"/> gives <paramref name="hash"/>, compared in constant time.</summary>
    public static bool Verify(string password, byte[] salt, byte[] hash, int iterations) =>
        CryptographicOperations.FixedTimeEquals(Derive(password, salt, iterations), hash);

    private static byte[] Derive(string password, byte[] salt, int iterations) =>
        Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, HashBytes);
}

using System.Diagnostics.CodeAnalysis;

namespace Battleship.Core
{
    /// <summary>
    /// The rules for <c>signup</c> and <c>login</c> (protocol.md §5, LOGIN-1).
    /// Lengths are <c>string.Length</c>, as <see cref="NicknamePolicy"/> and the
    /// web count them. Guests' nicknames follow <see cref="NicknamePolicy"/> instead.
    /// </summary>
    public static class AccountPolicy
    {
        public const int UsernameMaxLength = 16;
        public const int PasswordMinLength = 4;
        public const int PasswordMaxLength = 16;

        /// <summary>
        /// Returns the username as it is stored: trimmed, 1–16 characters and
        /// no control characters. Null when it breaks a rule.
        /// </summary>
        public static string? NormalizeUsername(string? raw)
        {
            if (raw == null) return null;

            string name = raw.Trim();
            if (name.Length == 0 || name.Length > UsernameMaxLength) return null;
            foreach (char c in name)
            {
                if (char.IsControl(c)) return null;
            }
            return name;
        }

        /// <summary>True for 4–16 characters of anything. Never trimmed: "pass " and "pass" differ.</summary>
        public static bool IsValidPassword([NotNullWhen(true)] string? password) =>
            password != null && password.Length >= PasswordMinLength && password.Length <= PasswordMaxLength;
    }
}

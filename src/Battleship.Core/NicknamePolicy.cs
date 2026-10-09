using System.Collections.Generic;

namespace Battleship.Core
{
    /// <summary>
    /// Turns the nickname a player typed into the one the server uses
    /// (protocol.md §5 <c>join</c>): trimmed, 1–16 characters, and unique.
    /// </summary>
    public static class NicknamePolicy
    {
        public const int MaxLength = 16;

        /// <summary>
        /// Returns the final name, or null when it's empty or longer than
        /// <see cref="MaxLength"/> after trimming. A name already in
        /// <paramref name="takenNames"/> gets a number: the 2nd "Alice" becomes
        /// "Alice (2)", the 3rd "Alice (3)". Duplicates are case-sensitive, and
        /// the number may take the result past <see cref="MaxLength"/>.
        /// </summary>
        public static string? Normalize(string? raw, IEnumerable<string> takenNames)
        {
            if (raw == null) return null;

            string name = raw.Trim();
            if (name.Length == 0 || name.Length > MaxLength) return null;

            var taken = new HashSet<string>(takenNames);
            if (!taken.Contains(name)) return name;

            for (int n = 2; ; n++)
            {
                string numbered = $"{name} ({n})";
                if (!taken.Contains(numbered)) return numbered;
            }
        }
    }
}

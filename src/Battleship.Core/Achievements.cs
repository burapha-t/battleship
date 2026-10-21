using System;
using System.Collections.Generic;
using System.Linq;

namespace Battleship.Core
{
    /// <summary>Authoritative badge conditions (#41), independent of storage and sockets.</summary>
    public static class Achievements
    {
        private static readonly int[] Wins = { 5, 10, 20, 50, 100 };
        private static readonly int[] Accuracy = { 40, 50, 60, 70, 80 };
        private static readonly int[] Streak = { 4, 6, 8, 10, 12 };
        public static IReadOnlyList<string> Catalogue { get; } = Array.AsReadOnly(
            Wins.Select(n => "wins-" + n).Concat(Accuracy.Select(n => "accuracy-" + n))
                .Concat(Streak.Select(n => "streak-" + n)).ToArray());

        public static IReadOnlyList<string> Earned(int totalWins, int shots, int hits, int bestStreak) =>
            Wins.Where(n => totalWins >= n).Select(n => "wins-" + n)
                .Concat(Accuracy.Where(n => shots > 0 && (long)hits * 100 > (long)n * shots).Select(n => "accuracy-" + n))
                .Concat(Streak.Where(n => bestStreak >= n).Select(n => "streak-" + n)).ToArray();
    }
}

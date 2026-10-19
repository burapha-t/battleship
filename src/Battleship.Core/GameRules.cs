namespace Battleship.Core
{
    /// <summary>Fixed game constants. Must match docs/implement/protocol.md.</summary>
    public static class GameRules
    {
        public const int GridSize = 8;
        public const int ShipLength = 4;
        public const int ShipCount = 4;
        public const int TurnSeconds = 10;

        /// <summary>Hits in a row before the server sends <c>streakUpdate</c>.</summary>
        public const int StreakMinimum = 2;
    }
}

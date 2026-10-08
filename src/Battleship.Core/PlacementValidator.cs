using System.Collections.Generic;

namespace Battleship.Core
{
    /// <summary>
    /// Checks a fleet layout against the ship rules in protocol.md §2. The
    /// server runs this on every <c>place</c> message, whatever the client
    /// already checked.
    /// </summary>
    public static class PlacementValidator
    {
        /// <summary>
        /// Returns null when the layout is valid, otherwise a sentence the
        /// player can read. The server sends it as the <c>message</c> of an
        /// <c>invalid-placement</c> error. Ships are numbered from 1 in the
        /// order they were sent, and the cells of a ship can be in any order.
        /// </summary>
        public static string? Validate(IReadOnlyList<IReadOnlyList<Coord>> ships)
        {
            if (ships == null || ships.Count != GameRules.ShipCount)
                return $"Place exactly {GameRules.ShipCount} ships.";

            var taken = new HashSet<Coord>();
            for (int i = 0; i < ships.Count; i++)
            {
                var ship = ships[i];
                int number = i + 1;

                if (ship == null || ship.Count != GameRules.ShipLength)
                    return $"Ship {number} must cover exactly {GameRules.ShipLength} cells.";

                foreach (var cell in ship)
                {
                    if (!IsOnGrid(cell))
                        return $"Ship {number} is off the grid.";
                }

                foreach (var cell in ship)
                {
                    if (!taken.Add(cell))
                        return $"Ship {number} uses a cell that is already taken.";
                }

                bool sameRow = true;
                bool sameCol = true;
                foreach (var cell in ship)
                {
                    if (cell.Row != ship[0].Row) sameRow = false;
                    if (cell.Col != ship[0].Col) sameCol = false;
                }
                if (!sameRow && !sameCol)
                    return $"Ship {number} is not in a straight line.";

                // The cells are distinct and share a row or column, so they
                // are side by side exactly when the two ends are
                // ShipLength - 1 apart.
                int min = int.MaxValue;
                int max = int.MinValue;
                foreach (var cell in ship)
                {
                    int along = sameRow ? cell.Col : cell.Row;
                    if (along < min) min = along;
                    if (along > max) max = along;
                }
                if (max - min != GameRules.ShipLength - 1)
                    return $"Ship {number} has a gap between its cells.";
            }

            return null;
        }

        private static bool IsOnGrid(Coord cell) =>
            cell.Row >= 0 && cell.Row < GameRules.GridSize &&
            cell.Col >= 0 && cell.Col < GameRules.GridSize;
    }
}

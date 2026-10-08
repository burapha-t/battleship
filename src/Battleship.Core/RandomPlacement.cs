using System;
using System.Collections.Generic;

namespace Battleship.Core
{
    /// <summary>
    /// Builds a random fleet layout that passes <see cref="PlacementValidator"/>.
    /// Tests use it to place ships without hand-writing coordinates.
    /// </summary>
    public static class RandomPlacement
    {
        /// <summary>
        /// Returns <see cref="GameRules.ShipCount"/> ships in the type
        /// <see cref="PlacementValidator.Validate"/> accepts. The layout
        /// depends only on <paramref name="random"/>, so the same seed gives
        /// the same layout.
        /// </summary>
        public static IReadOnlyList<IReadOnlyList<Coord>> Generate(Random random)
        {
            if (random == null) throw new ArgumentNullException(nameof(random));

            var ships = new Coord[GameRules.ShipCount][];
            var taken = new HashSet<Coord>();

            // Three ships cover 12 cells, and blocking both halves of every
            // row takes 16, so there is always room and the loop ends.
            for (int i = 0; i < ships.Length; i++)
            {
                Coord[] ship;
                do
                {
                    ship = RandomShip(random);
                } while (Overlaps(ship, taken));

                foreach (var cell in ship) taken.Add(cell);
                ships[i] = ship;
            }

            return ships;
        }

        // The start is picked so the ship ends on the grid, which leaves
        // overlap as the only reason to try again.
        private static Coord[] RandomShip(Random random)
        {
            bool horizontal = random.Next(2) == 0;
            int across = random.Next(GameRules.GridSize);
            int along = random.Next(GameRules.GridSize - GameRules.ShipLength + 1);

            var cells = new Coord[GameRules.ShipLength];
            for (int i = 0; i < cells.Length; i++)
                cells[i] = horizontal ? new Coord(across, along + i) : new Coord(along + i, across);
            return cells;
        }

        private static bool Overlaps(Coord[] ship, HashSet<Coord> taken)
        {
            foreach (var cell in ship)
            {
                if (taken.Contains(cell)) return true;
            }
            return false;
        }
    }
}

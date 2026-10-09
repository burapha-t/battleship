using System.Collections.Generic;

namespace Battleship.Core
{
    /// <summary>
    /// What one shot did. The match engine turns it into a <c>fireResult</c>
    /// message (protocol.md §4).
    /// </summary>
    public sealed class ShotResult
    {
        public ShotResult(bool hit, bool sunk, bool allSunk, IReadOnlyList<Coord>? sunkCells)
        {
            Hit = hit;
            Sunk = sunk;
            AllSunk = allSunk;
            SunkCells = sunkCells;
        }

        public bool Hit { get; }

        /// <summary>True if this shot completed a ship.</summary>
        public bool Sunk { get; }

        /// <summary>True if this shot sank the board's last ship.</summary>
        public bool AllSunk { get; }

        /// <summary>The sunk ship's cells, or null when <see cref="Sunk"/> is false.</summary>
        public IReadOnlyList<Coord>? SunkCells { get; }
    }
}

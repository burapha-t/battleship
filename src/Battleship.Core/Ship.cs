using System;
using System.Collections.Generic;

namespace Battleship.Core
{
    /// <summary>
    /// One ship: its cells and which of them have been hit. It doesn't check
    /// the shape; <see cref="PlacementValidator"/> does that first.
    /// </summary>
    public sealed class Ship
    {
        private readonly HashSet<Coord> _hits = new HashSet<Coord>();

        public Ship(IReadOnlyList<Coord> cells)
        {
            if (cells == null) throw new ArgumentNullException(nameof(cells));
            Cells = new List<Coord>(cells);
        }

        /// <summary>The cells, in the order they were placed.</summary>
        public IReadOnlyList<Coord> Cells { get; }

        /// <summary>True once every cell has been hit.</summary>
        public bool IsSunk => _hits.Count == Cells.Count;

        public bool Occupies(Coord cell)
        {
            foreach (var own in Cells)
            {
                if (own == cell) return true;
            }
            return false;
        }

        /// <summary>
        /// Records a hit on one of this ship's cells. Hitting the same cell
        /// twice counts once. A cell that isn't part of the ship throws,
        /// because the caller should have checked <see cref="Occupies"/>.
        /// </summary>
        public void RegisterHit(Coord cell)
        {
            if (!Occupies(cell))
                throw new ArgumentException($"{cell} is not part of this ship.", nameof(cell));
            _hits.Add(cell);
        }
    }
}

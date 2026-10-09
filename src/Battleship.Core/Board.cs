using System;
using System.Collections.Generic;

namespace Battleship.Core
{
    /// <summary>
    /// One player's grid on the server: their ships and every shot fired at
    /// them. The only code that decides hit or miss.
    /// </summary>
    public sealed class Board
    {
        private readonly List<Ship> _ships;
        private readonly HashSet<Coord> _shots = new HashSet<Coord>();

        /// <summary>Takes the ships as given; validate them first.</summary>
        public Board(IReadOnlyList<Ship> ships)
        {
            if (ships == null) throw new ArgumentNullException(nameof(ships));
            _ships = new List<Ship>(ships);
        }

        public IReadOnlyList<Ship> Ships => _ships;

        /// <summary>True if that cell was already fired at.</summary>
        public bool IsShot(Coord cell) => _shots.Contains(cell);

        /// <summary>
        /// Fires at one cell. A cell off the grid throws
        /// <see cref="ArgumentOutOfRangeException"/> and a repeat shot throws
        /// <see cref="InvalidOperationException"/>: the engine checks both
        /// first, so a throw means a bug.
        /// </summary>
        public ShotResult Fire(Coord cell)
        {
            if (cell.Row < 0 || cell.Row >= GameRules.GridSize || cell.Col < 0 || cell.Col >= GameRules.GridSize)
                throw new ArgumentOutOfRangeException(nameof(cell), $"{cell} is off the grid.");
            if (!_shots.Add(cell))
                throw new InvalidOperationException($"{cell} was already fired at.");

            foreach (var ship in _ships)
            {
                if (!ship.Occupies(cell)) continue;

                ship.RegisterHit(cell);
                if (!ship.IsSunk) return new ShotResult(true, false, false, null);
                return new ShotResult(true, true, AllSunk(), ship.Cells);
            }

            return new ShotResult(false, false, false, null);
        }

        private bool AllSunk()
        {
            foreach (var ship in _ships)
            {
                if (!ship.IsSunk) return false;
            }
            return true;
        }
    }
}

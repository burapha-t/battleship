using System;

namespace Battleship.Core
{
    /// <summary>
    /// One grid cell, zero-indexed: Row 0 is the top, Col 0 is the left
    /// (protocol.md §2). Two Coords with the same Row and Col are equal, so
    /// == and HashSet&lt;Coord&gt; work as expected.
    /// </summary>
    public readonly struct Coord : IEquatable<Coord>
    {
        public int Row { get; }
        public int Col { get; }

        public Coord(int row, int col)
        {
            Row = row;
            Col = col;
        }

        public bool Equals(Coord other) => Row == other.Row && Col == other.Col;
        public override bool Equals(object? obj) => obj is Coord other && Equals(other);
        public override int GetHashCode() => HashCode.Combine(Row, Col);
        public override string ToString() => $"[{Row},{Col}]";

        public static bool operator ==(Coord a, Coord b) => a.Equals(b);
        public static bool operator !=(Coord a, Coord b) => !a.Equals(b);
    }
}

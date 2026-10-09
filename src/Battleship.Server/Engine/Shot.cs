using Battleship.Core;

namespace Battleship.Server.Engine;

/// <summary>One entry in a match's move log.</summary>
public sealed record Shot(int TurnNumber, string By, string Target, Coord Cell, bool Hit, bool Auto);

namespace Battleship.Server.Engine;

/// <summary>The three phases of a <see cref="Match"/>, in order.</summary>
public enum MatchPhase
{
    Placing,
    Playing,
    MatchEnd,
}

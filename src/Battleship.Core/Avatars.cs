using System;
using System.Collections.Generic;

namespace Battleship.Core
{
    /// <summary>The profile pictures a player can choose (#42); the empty string means none.</summary>
    public static class Avatars
    {
        public static IReadOnlyList<string> Catalogue { get; } = Array.AsReadOnly(new[]
        { "whale", "octopus", "crab", "pufferfish", "turtle", "jellyfish", "starfish", "shark" });
    }
}

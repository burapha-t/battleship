using System;
using System.Collections.Generic;

namespace Battleship.Core.Protocol
{
    // Own profile (#42) and authoritative badge unlocks (#41). Property order is wire order.
    public sealed class ProfileGet : ProtocolMessage
    {
        public ProfileGet() : base("profileGet") { }
    }

    public sealed class ProfileUpdate : ProtocolMessage
    {
        public ProfileUpdate() : base("profileUpdate") { }
        public string? Avatar { get; set; }
        public IReadOnlyList<string>? ShownBadges { get; set; }
    }

    public sealed class BadgeUnlock
    {
        public string Code { get; set; } = "";
        public string UnlockedAt { get; set; } = "";
    }

    public sealed class AchievementUnlocked : ProtocolMessage
    {
        public AchievementUnlocked() : base("achievementUnlocked") { }
        public string MatchId { get; set; } = "";
        public IReadOnlyList<BadgeUnlock> Badges { get; set; } = Array.Empty<BadgeUnlock>();
    }

    public sealed class Profile : ProtocolMessage
    {
        public Profile() : base("profile") { }
        public string Avatar { get; set; } = "";
        public IReadOnlyList<string> ShownBadges { get; set; } = Array.Empty<string>();
        public int Wins { get; set; }
        public double BestAccuracy { get; set; }
        public int BestStreak { get; set; }
        public IReadOnlyList<BadgeUnlock> Badges { get; set; } = Array.Empty<BadgeUnlock>();
    }
}

using Battleship.Core.Protocol;

namespace Battleship.Core.Tests;

// #41: strict accuracy boundaries and inclusive win/streak tiers.
public class AchievementsTests
{
    public static IEnumerable<object[]> Thresholds() =>
        new[] { 5, 10, 20, 50, 100 }.Select(n => new object[] { "wins", n })
        .Concat(new[] { 40, 50, 60, 70, 80 }.Select(n => new object[] { "accuracy", n }))
        .Concat(new[] { 4, 6, 8, 10, 12 }.Select(n => new object[] { "streak", n }));

    [Theory]
    [MemberData(nameof(Thresholds))]
    public void EveryTier_BelowAtAndAbove(string group, int threshold)
    {
        for (int delta = -1; delta <= 1; delta++)
        {
            int value = threshold + delta;
            var earned = Achievements.Earned(group == "wins" ? value : 0,
                group == "accuracy" ? 1000 : 0, group == "accuracy" ? threshold * 10 + delta : 0,
                group == "streak" ? value : 0);
            Assert.Equal(group == "accuracy" ? delta > 0 : delta >= 0, earned.Contains($"{group}-{threshold}"));
        }
    }

    [Fact]
    public void Exactly40PercentIsNotOver40_But40Point1Is()
    {
        Assert.DoesNotContain("accuracy-40", Achievements.Earned(0, 1000, 400, 0));
        Assert.Contains("accuracy-40", Achievements.Earned(0, 1000, 401, 0));
        Assert.Empty(Achievements.Earned(0, 0, 0, 0));
        Assert.Equal(Achievements.Catalogue, Achievements.Earned(100, 16, 16, 12));
        Assert.Equal(15, Achievements.Catalogue.Distinct().Count());
    }

    [Theory]
    [InlineData("{\"type\":\"profileGet\"}")]
    [InlineData("{\"type\":\"profileUpdate\",\"avatar\":\"whale\",\"shownBadges\":[\"wins-5\"]}")]
    [InlineData("{\"type\":\"profile\",\"avatar\":\"\",\"shownBadges\":[],\"wins\":0,\"bestAccuracy\":0,\"bestStreak\":0,\"badges\":[]}")]
    [InlineData("{\"type\":\"achievementUnlocked\",\"matchId\":\"m1\",\"badges\":[{\"code\":\"wins-5\",\"unlockedAt\":\"2026-10-21T07:00:00Z\"}]}")]
    public void ProfileAndUnlock_RoundTrip(string json) => Assert.Equal(json, ProtocolJson.Serialize(ProtocolJson.Parse(json)!));
}

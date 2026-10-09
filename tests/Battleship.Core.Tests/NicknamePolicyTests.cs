namespace Battleship.Core.Tests;

public class NicknamePolicyTests
{
    private static readonly string[] Nobody = Array.Empty<string>();

    [Fact]
    public void Empty_IsRejected()
    {
        Assert.Null(NicknamePolicy.Normalize("", Nobody));
    }

    [Fact]
    public void OnlySpaces_IsRejected()
    {
        Assert.Null(NicknamePolicy.Normalize("   ", Nobody));
    }

    [Fact]
    public void Null_IsRejected()
    {
        Assert.Null(NicknamePolicy.Normalize(null, Nobody));
    }

    [Fact]
    public void SeventeenCharacters_IsRejected()
    {
        Assert.Null(NicknamePolicy.Normalize(new string('a', 17), Nobody));
    }

    [Fact]
    public void SixteenCharacters_IsAccepted()
    {
        Assert.Equal(new string('a', 16), NicknamePolicy.Normalize(new string('a', 16), Nobody));
    }

    [Fact]
    public void SpacesAround_AreTrimmed_BeforeTheLengthCheck()
    {
        Assert.Equal("Alice", NicknamePolicy.Normalize("  Alice  ", Nobody));
        Assert.Equal(new string('a', 16), NicknamePolicy.Normalize(" " + new string('a', 16) + " ", Nobody));
    }

    [Fact]
    public void SecondDuplicate_GetsNumberTwo()
    {
        Assert.Equal("Alice (2)", NicknamePolicy.Normalize("Alice", new[] { "Alice" }));
    }

    [Fact]
    public void ThirdDuplicate_GetsNumberThree()
    {
        Assert.Equal("Alice (3)", NicknamePolicy.Normalize("Alice", new[] { "Alice", "Alice (2)" }));
    }

    [Fact]
    public void DuplicateCheck_IsCaseSensitive()
    {
        Assert.Equal("alice", NicknamePolicy.Normalize("alice", new[] { "Alice" }));
    }
}

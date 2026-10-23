namespace Battleship.Core.Tests;

public class AccountPolicyTests
{
    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    [InlineData("aaaaaaaaaaaaaaaaa")] // 17
    public void Username_EmptyOrTooLong_IsRejected(string? raw)
    {
        Assert.Null(AccountPolicy.NormalizeUsername(raw));
    }

    [Theory]
    [InlineData("a")]
    [InlineData("aaaaaaaaaaaaaaaa")] // 16
    public void Username_OneToSixteen_IsAccepted(string raw)
    {
        Assert.Equal(raw, AccountPolicy.NormalizeUsername(raw));
    }

    [Fact]
    public void Username_IsTrimmed_BeforeTheLengthCheck()
    {
        Assert.Equal("Alice", AccountPolicy.NormalizeUsername("  Alice  "));
        Assert.Equal(new string('a', 16), AccountPolicy.NormalizeUsername(" " + new string('a', 16) + " "));
    }

    [Theory]
    [InlineData("a\tb")]
    [InlineData("a\u0000")]
    public void Username_WithAControlCharacter_IsRejected(string raw)
    {
        Assert.Null(AccountPolicy.NormalizeUsername(raw));
    }

    [Fact]
    public void Username_InThai_CountsUtf16Units()
    {
        Assert.Equal("กัปตัน", AccountPolicy.NormalizeUsername("กัปตัน"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("abc")] // 3
    [InlineData("aaaaaaaaaaaaaaaaa")] // 17
    public void Password_OutsideFourToSixteen_IsRejected(string? password)
    {
        Assert.False(AccountPolicy.IsValidPassword(password));
    }

    [Theory]
    [InlineData("abcd")] // 4
    [InlineData("aaaaaaaaaaaaaaaa")] // 16
    [InlineData(" abc")] // 4 with the space: never trimmed
    public void Password_FourToSixteen_IsAccepted(string password)
    {
        Assert.True(AccountPolicy.IsValidPassword(password));
    }

    [Fact]
    public void Limits_AreTheProtocolOnes()
    {
        Assert.Equal(16, AccountPolicy.UsernameMaxLength);
        Assert.Equal(4, AccountPolicy.PasswordMinLength);
        Assert.Equal(16, AccountPolicy.PasswordMaxLength);
    }
}

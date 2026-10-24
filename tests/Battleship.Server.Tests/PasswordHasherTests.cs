using Battleship.Server.Accounts;

namespace Battleship.Server.Tests;

public class PasswordHasherTests
{
    // Low, so the tests run fast; the server uses the default.
    private readonly PasswordHasher _hasher = new(1_000);

    [Fact]
    public void AHash_VerifiesWithItsOwnPassword_AndNotAnother()
    {
        var (salt, hash) = _hasher.Hash("hunter22");

        Assert.True(PasswordHasher.Verify("hunter22", salt, hash, 1_000));
        Assert.False(PasswordHasher.Verify("hunter23", salt, hash, 1_000));
        Assert.False(PasswordHasher.Verify("hunter22 ", salt, hash, 1_000));
    }

    [Fact]
    public void TwoHashesOfOnePassword_GetDifferentSalts()
    {
        var first = _hasher.Hash("hunter22");
        var second = _hasher.Hash("hunter22");

        Assert.NotEqual(first.Salt, second.Salt);
        Assert.NotEqual(first.Hash, second.Hash);
    }

    [Fact]
    public void Salt_Is16Bytes_AndHash32()
    {
        var (salt, hash) = _hasher.Hash("hunter22");

        Assert.Equal(16, salt.Length);
        Assert.Equal(32, hash.Length);
    }

    [Fact]
    public void Verify_UsesTheIterationCountItIsGiven()
    {
        var (salt, hash) = _hasher.Hash("hunter22");

        Assert.False(PasswordHasher.Verify("hunter22", salt, hash, 2_000));
        Assert.True(PasswordHasher.Verify("hunter22", salt, hash, _hasher.Iterations));
    }

    [Fact]
    public void Default_Is600000Iterations()
    {
        Assert.Equal(600_000, new PasswordHasher().Iterations);
    }
}

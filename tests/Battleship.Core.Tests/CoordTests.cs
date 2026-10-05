namespace Battleship.Core.Tests;

// Sample to copy: one test class per Core class, one [Fact] per behaviour.
public class CoordTests
{
    [Fact]
    public void SameRowAndCol_AreEqual()
    {
        var a = new Coord(3, 5);
        var b = new Coord(3, 5);

        Assert.Equal(a, b);
        Assert.True(a == b);
        Assert.Contains(b, new HashSet<Coord> { a });
    }

    [Fact]
    public void SwappedRowAndCol_AreNotEqual()
    {
        var a = new Coord(3, 5);
        var b = new Coord(5, 3);

        Assert.NotEqual(a, b);
        Assert.True(a != b);
    }
}

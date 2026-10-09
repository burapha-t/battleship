namespace Battleship.Core.Tests;

public class BoardTests
{
    // Four horizontal ships on rows 0, 2, 4 and 6, columns 0-3.
    private static Board NewBoard()
    {
        var ships = new List<Ship>();
        for (int row = 0; row < 8; row += 2)
            ships.Add(new Ship(new[] { new Coord(row, 0), new Coord(row, 1), new Coord(row, 2), new Coord(row, 3) }));
        return new Board(ships);
    }

    [Fact]
    public void ShotAtWater_IsAMiss()
    {
        var result = NewBoard().Fire(new Coord(1, 1));

        Assert.False(result.Hit);
        Assert.False(result.Sunk);
        Assert.False(result.AllSunk);
        Assert.Null(result.SunkCells);
    }

    [Fact]
    public void ShotAtAShip_IsAHit_NotSunk()
    {
        var result = NewBoard().Fire(new Coord(2, 2));

        Assert.True(result.Hit);
        Assert.False(result.Sunk);
        Assert.Null(result.SunkCells);
    }

    [Fact]
    public void LastCellOfAShip_SinksIt_WithItsCells()
    {
        var board = NewBoard();
        board.Fire(new Coord(4, 0));
        board.Fire(new Coord(4, 1));
        board.Fire(new Coord(4, 3));

        var result = board.Fire(new Coord(4, 2));

        Assert.True(result.Hit);
        Assert.True(result.Sunk);
        Assert.False(result.AllSunk);
        Assert.Equal(new[] { new Coord(4, 0), new Coord(4, 1), new Coord(4, 2), new Coord(4, 3) }, result.SunkCells);
    }

    [Fact]
    public void LastCellOfTheLastShip_SinksAll()
    {
        var board = NewBoard();
        ShotResult? last = null;
        for (int row = 0; row < 8; row += 2)
        {
            for (int col = 0; col < 4; col++)
            {
                Assert.False(last?.AllSunk ?? false);
                last = board.Fire(new Coord(row, col));
            }
        }

        Assert.True(last!.Sunk);
        Assert.True(last.AllSunk);
    }

    [Fact]
    public void IsShot_IsTrueOnlyAfterFiring()
    {
        var board = NewBoard();

        Assert.False(board.IsShot(new Coord(5, 5)));
        board.Fire(new Coord(5, 5));
        Assert.True(board.IsShot(new Coord(5, 5)));
    }

    [Fact]
    public void RepeatShot_IsRejected()
    {
        var board = NewBoard();
        board.Fire(new Coord(0, 0));

        Assert.Throws<InvalidOperationException>(() => board.Fire(new Coord(0, 0)));
    }

    [Theory]
    [InlineData(-1, 0)]
    [InlineData(0, -1)]
    [InlineData(8, 0)]
    [InlineData(0, 8)]
    public void ShotOffTheGrid_IsRejected(int row, int col)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => NewBoard().Fire(new Coord(row, col)));
    }
}

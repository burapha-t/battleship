namespace Battleship.Core.Tests;

public class ShipTests
{
    private static Ship NewShip() =>
        new(new[] { new Coord(2, 1), new Coord(2, 2), new Coord(2, 3), new Coord(2, 4) });

    [Fact]
    public void OneHit_IsRecorded_ShipNotSunk()
    {
        var ship = NewShip();

        ship.RegisterHit(new Coord(2, 2));

        Assert.False(ship.IsSunk);
    }

    [Fact]
    public void SameCellHitTwice_CountsOnce()
    {
        var ship = NewShip();

        ship.RegisterHit(new Coord(2, 1));
        ship.RegisterHit(new Coord(2, 1));
        ship.RegisterHit(new Coord(2, 2));
        ship.RegisterHit(new Coord(2, 3));

        Assert.False(ship.IsSunk);
    }

    [Fact]
    public void AllFourCellsHit_SinksTheShip_NotBefore()
    {
        var ship = NewShip();

        for (int col = 1; col <= 3; col++)
        {
            ship.RegisterHit(new Coord(2, col));
            Assert.False(ship.IsSunk);
        }
        ship.RegisterHit(new Coord(2, 4));

        Assert.True(ship.IsSunk);
    }

    [Fact]
    public void Occupies_IsTrueOnlyForItsOwnCells()
    {
        var ship = NewShip();

        Assert.True(ship.Occupies(new Coord(2, 4)));
        Assert.False(ship.Occupies(new Coord(2, 5)));
        Assert.False(ship.Occupies(new Coord(3, 1)));
    }

    [Fact]
    public void HitOnAnotherCell_Throws()
    {
        var ship = NewShip();

        Assert.Throws<ArgumentException>(() => ship.RegisterHit(new Coord(0, 0)));
    }
}

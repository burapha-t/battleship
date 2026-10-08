namespace Battleship.Core.Tests;

public class PlacementValidatorTests
{
    // Four cells starting at (row, col), going right or down.
    private static Coord[] Ship(int row, int col, bool horizontal = true)
    {
        var cells = new Coord[GameRules.ShipLength];
        for (int i = 0; i < cells.Length; i++)
            cells[i] = horizontal ? new Coord(row, col + i) : new Coord(row + i, col);
        return cells;
    }

    // Four horizontal ships on rows 0, 2, 4 and 6. Tests replace one of them.
    private static List<Coord[]> ValidFleet() =>
        new() { Ship(0, 0), Ship(2, 0), Ship(4, 0), Ship(6, 0) };

    [Fact]
    public void HorizontalFleet_IsValid()
    {
        Assert.Null(PlacementValidator.Validate(ValidFleet()));
    }

    [Fact]
    public void MixedDirectionsTouchingEdges_IsValid()
    {
        var ships = new List<Coord[]>
        {
            Ship(0, 0, horizontal: false),
            Ship(4, 7, horizontal: false),
            Ship(7, 0),
            Ship(0, 4),
        };

        Assert.Null(PlacementValidator.Validate(ships));
    }

    [Fact]
    public void CellsOutOfOrder_IsValid()
    {
        var ships = ValidFleet();
        ships[0] = new[] { new Coord(0, 3), new Coord(0, 1), new Coord(0, 2), new Coord(0, 0) };

        Assert.Null(PlacementValidator.Validate(ships));
    }

    [Fact]
    public void TooFewShips_IsRejected()
    {
        var ships = ValidFleet();
        ships.RemoveAt(3);

        Assert.Equal("Place exactly 4 ships.", PlacementValidator.Validate(ships));
    }

    [Fact]
    public void TooManyShips_IsRejected()
    {
        var ships = ValidFleet();
        ships.Add(Ship(7, 4));

        Assert.Equal("Place exactly 4 ships.", PlacementValidator.Validate(ships));
    }

    [Fact]
    public void ShipWithWrongLength_IsRejected()
    {
        var ships = ValidFleet();
        ships[1] = new[] { new Coord(2, 0), new Coord(2, 1), new Coord(2, 2) };

        Assert.Equal("Ship 2 must cover exactly 4 cells.", PlacementValidator.Validate(ships));
    }

    [Fact]
    public void ShipPastTheEdge_IsRejected()
    {
        var ships = ValidFleet();
        ships[2] = Ship(4, 5);

        Assert.Equal("Ship 3 is off the grid.", PlacementValidator.Validate(ships));
    }

    [Fact]
    public void ShipWithNegativeCell_IsRejected()
    {
        var ships = ValidFleet();
        ships[0] = Ship(-1, 0, horizontal: false);

        Assert.Equal("Ship 1 is off the grid.", PlacementValidator.Validate(ships));
    }

    [Fact]
    public void BentShip_IsRejected()
    {
        var ships = ValidFleet();
        ships[1] = new[] { new Coord(2, 0), new Coord(2, 1), new Coord(2, 2), new Coord(3, 2) };

        Assert.Equal("Ship 2 is not in a straight line.", PlacementValidator.Validate(ships));
    }

    [Fact]
    public void ShipWithGap_IsRejected()
    {
        var ships = ValidFleet();
        ships[3] = new[] { new Coord(6, 0), new Coord(6, 1), new Coord(6, 2), new Coord(6, 4) };

        Assert.Equal("Ship 4 has a gap between its cells.", PlacementValidator.Validate(ships));
    }

    [Fact]
    public void OverlappingShips_AreRejected()
    {
        var ships = ValidFleet();
        ships[1] = Ship(0, 3, horizontal: false);

        Assert.Equal("Ship 2 uses a cell that is already taken.", PlacementValidator.Validate(ships));
    }

    [Fact]
    public void ShipRepeatingACell_IsRejected()
    {
        var ships = ValidFleet();
        ships[0] = new[] { new Coord(0, 0), new Coord(0, 0), new Coord(0, 1), new Coord(0, 2) };

        Assert.Equal("Ship 1 uses a cell that is already taken.", PlacementValidator.Validate(ships));
    }

    // The place example in protocol.md §5.
    [Fact]
    public void ProtocolExample_IsValid()
    {
        var ships = new List<Coord[]>
        {
            new[] { new Coord(0, 0), new Coord(0, 1), new Coord(0, 2), new Coord(0, 3) },
            new[] { new Coord(2, 1), new Coord(3, 1), new Coord(4, 1), new Coord(5, 1) },
            new[] { new Coord(7, 0), new Coord(7, 1), new Coord(7, 2), new Coord(7, 3) },
            new[] { new Coord(1, 6), new Coord(2, 6), new Coord(3, 6), new Coord(4, 6) },
        };

        Assert.Null(PlacementValidator.Validate(ships));
    }

    [Fact]
    public void VerticalFleet_IsValid()
    {
        var ships = new List<Coord[]>
        {
            Ship(0, 0, horizontal: false),
            Ship(0, 2, horizontal: false),
            Ship(4, 4, horizontal: false),
            Ship(4, 6, horizontal: false),
        };

        Assert.Null(PlacementValidator.Validate(ships));
    }

    [Fact]
    public void ShipsSideBySide_AreValid()
    {
        var ships = new List<Coord[]> { Ship(0, 0), Ship(1, 0), Ship(2, 0), Ship(3, 0) };

        Assert.Null(PlacementValidator.Validate(ships));
    }

    [Fact]
    public void ShipsEndToEnd_AreValid()
    {
        var ships = new List<Coord[]> { Ship(0, 0), Ship(0, 4), Ship(7, 0), Ship(7, 4) };

        Assert.Null(PlacementValidator.Validate(ships));
    }

    [Fact]
    public void VerticalCellsOutOfOrder_IsValid()
    {
        var ships = ValidFleet();
        ships[3] = new[] { new Coord(6, 7), new Coord(4, 7), new Coord(7, 7), new Coord(5, 7) };

        Assert.Null(PlacementValidator.Validate(ships));
    }

    [Theory]
    [InlineData(0, 4, true)]
    [InlineData(7, 4, true)]
    [InlineData(0, 7, false)]
    [InlineData(4, 4, false)]
    [InlineData(4, 7, false)]
    public void ShipEndingOnTheLastRowOrCol_IsValid(int row, int col, bool horizontal)
    {
        var ships = ValidFleet();
        ships[0] = Ship(row, col, horizontal);

        Assert.Null(PlacementValidator.Validate(ships));
    }

    [Fact]
    public void NullFleet_IsRejected()
    {
        Assert.Equal("Place exactly 4 ships.", PlacementValidator.Validate(null!));
    }

    [Fact]
    public void EmptyFleet_IsRejected()
    {
        Assert.Equal("Place exactly 4 ships.", PlacementValidator.Validate(new List<Coord[]>()));
    }

    [Fact]
    public void NullShip_IsRejected()
    {
        var ships = ValidFleet();
        ships[2] = null!;

        Assert.Equal("Ship 3 must cover exactly 4 cells.", PlacementValidator.Validate(ships));
    }

    [Fact]
    public void EmptyShip_IsRejected()
    {
        var ships = ValidFleet();
        ships[0] = new Coord[0];

        Assert.Equal("Ship 1 must cover exactly 4 cells.", PlacementValidator.Validate(ships));
    }

    [Fact]
    public void ShipTooLong_IsRejected()
    {
        var ships = ValidFleet();
        ships[3] = new[]
        {
            new Coord(6, 0), new Coord(6, 1), new Coord(6, 2), new Coord(6, 3), new Coord(6, 4),
        };

        Assert.Equal("Ship 4 must cover exactly 4 cells.", PlacementValidator.Validate(ships));
    }

    [Theory]
    [InlineData(0, 5, true)]
    [InlineData(5, 0, false)]
    [InlineData(0, -1, true)]
    [InlineData(-1, 0, false)]
    [InlineData(8, 0, true)]
    [InlineData(0, 8, false)]
    [InlineData(-1, 4, true)]
    [InlineData(4, -1, false)]
    public void ShipOffAnyEdge_IsRejected(int row, int col, bool horizontal)
    {
        var ships = ValidFleet();
        ships[0] = Ship(row, col, horizontal);

        Assert.Equal("Ship 1 is off the grid.", PlacementValidator.Validate(ships));
    }

    [Theory]
    [InlineData(int.MaxValue)]
    [InlineData(int.MinValue)]
    public void ShipWithHugeCoordinate_IsRejected(int far)
    {
        var ships = ValidFleet();
        ships[0] = new[] { new Coord(0, far), new Coord(0, 0), new Coord(0, 1), new Coord(0, 2) };

        Assert.Equal("Ship 1 is off the grid.", PlacementValidator.Validate(ships));
    }

    [Fact]
    public void DiagonalShip_IsRejected()
    {
        var ships = ValidFleet();
        ships[1] = new[] { new Coord(2, 4), new Coord(3, 5), new Coord(4, 6), new Coord(5, 7) };

        Assert.Equal("Ship 2 is not in a straight line.", PlacementValidator.Validate(ships));
    }

    [Fact]
    public void SquareShip_IsRejected()
    {
        var ships = ValidFleet();
        ships[2] = new[] { new Coord(4, 4), new Coord(4, 5), new Coord(5, 4), new Coord(5, 5) };

        Assert.Equal("Ship 3 is not in a straight line.", PlacementValidator.Validate(ships));
    }

    [Fact]
    public void VerticalShipWithGap_IsRejected()
    {
        var ships = ValidFleet();
        ships[0] = new[] { new Coord(0, 7), new Coord(1, 7), new Coord(2, 7), new Coord(4, 7) };

        Assert.Equal("Ship 1 has a gap between its cells.", PlacementValidator.Validate(ships));
    }

    [Fact]
    public void ShipSplitInTwoPairs_IsRejected()
    {
        var ships = ValidFleet();
        ships[3] = new[] { new Coord(6, 0), new Coord(6, 1), new Coord(6, 3), new Coord(6, 4) };

        Assert.Equal("Ship 4 has a gap between its cells.", PlacementValidator.Validate(ships));
    }

    [Fact]
    public void ShipWithGapAndCellsOutOfOrder_IsRejected()
    {
        var ships = ValidFleet();
        ships[3] = new[] { new Coord(6, 4), new Coord(6, 0), new Coord(6, 2), new Coord(6, 1) };

        Assert.Equal("Ship 4 has a gap between its cells.", PlacementValidator.Validate(ships));
    }

    [Fact]
    public void IdenticalShips_AreRejected()
    {
        var ships = ValidFleet();
        ships[3] = Ship(0, 0);

        Assert.Equal("Ship 4 uses a cell that is already taken.", PlacementValidator.Validate(ships));
    }

    [Fact]
    public void ShipsSharingOneEndCell_AreRejected()
    {
        var ships = ValidFleet();
        ships[1] = Ship(0, 3);

        Assert.Equal("Ship 2 uses a cell that is already taken.", PlacementValidator.Validate(ships));
    }

    [Fact]
    public void VerticalShipsSharingACell_AreRejected()
    {
        var ships = ValidFleet();
        ships[2] = Ship(0, 7, horizontal: false);
        ships[3] = Ship(3, 7, horizontal: false);

        Assert.Equal("Ship 4 uses a cell that is already taken.", PlacementValidator.Validate(ships));
    }

    [Fact]
    public void ShipMadeOfOneCell_IsRejected()
    {
        var ships = ValidFleet();
        ships[0] = new[] { new Coord(0, 0), new Coord(0, 0), new Coord(0, 0), new Coord(0, 0) };

        Assert.Equal("Ship 1 uses a cell that is already taken.", PlacementValidator.Validate(ships));
    }

    [Fact]
    public void TwoBadShips_ReportsTheFirst()
    {
        var ships = ValidFleet();
        ships[1] = new[] { new Coord(2, 0), new Coord(2, 1), new Coord(2, 2), new Coord(3, 2) };
        ships[3] = new[] { new Coord(6, 0), new Coord(6, 1), new Coord(6, 2), new Coord(6, 4) };

        Assert.Equal("Ship 2 is not in a straight line.", PlacementValidator.Validate(ships));
    }
}

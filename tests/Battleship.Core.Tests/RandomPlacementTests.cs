namespace Battleship.Core.Tests;

public class RandomPlacementTests
{
    [Fact]
    public void Seeds0To999_AllPassValidate()
    {
        for (int seed = 0; seed < 1000; seed++)
        {
            var ships = RandomPlacement.Generate(new Random(seed));

            Assert.True(PlacementValidator.Validate(ships) == null,
                $"Seed {seed}: {PlacementValidator.Validate(ships)}");
        }
    }

    [Fact]
    public void SameSeed_GivesSameLayout()
    {
        for (int seed = 0; seed < 1000; seed++)
        {
            var first = RandomPlacement.Generate(new Random(seed));
            var second = RandomPlacement.Generate(new Random(seed));

            Assert.Equal(first, second);
        }
    }

    [Fact]
    public void SameRandomUsedTwice_GivesTwoValidLayouts()
    {
        var random = new Random(7);

        Assert.Null(PlacementValidator.Validate(RandomPlacement.Generate(random)));
        Assert.Null(PlacementValidator.Validate(RandomPlacement.Generate(random)));
    }

    [Fact]
    public void DifferentSeeds_GiveDifferentLayouts()
    {
        var layouts = new HashSet<string>();
        for (int seed = 0; seed < 1000; seed++)
            layouts.Add(Describe(RandomPlacement.Generate(new Random(seed))));

        Assert.True(layouts.Count > 900, $"Only {layouts.Count} different layouts in 1000 seeds.");
    }

    [Fact]
    public void Seeds0To999_UseBothDirections()
    {
        int horizontal = 0;
        int vertical = 0;
        for (int seed = 0; seed < 1000; seed++)
        {
            foreach (var ship in RandomPlacement.Generate(new Random(seed)))
            {
                if (ship[0].Row == ship[1].Row) horizontal++;
                else vertical++;
            }
        }

        Assert.True(horizontal > 1000, $"Only {horizontal} horizontal ships in 4000.");
        Assert.True(vertical > 1000, $"Only {vertical} vertical ships in 4000.");
    }

    [Fact]
    public void Seeds0To999_ReachEveryCell()
    {
        var used = new HashSet<Coord>();
        for (int seed = 0; seed < 1000; seed++)
        {
            foreach (var ship in RandomPlacement.Generate(new Random(seed)))
                used.UnionWith(ship);
        }

        Assert.Equal(GameRules.GridSize * GameRules.GridSize, used.Count);
    }

    [Fact]
    public void NullRandom_Throws()
    {
        Assert.Throws<ArgumentNullException>(() => RandomPlacement.Generate(null!));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(-1)]
    [InlineData(42)]
    [InlineData(123456789)]
    [InlineData(int.MaxValue)]
    [InlineData(int.MinValue)]
    public void UnusualSeed_GivesValidRepeatableLayout(int seed)
    {
        var first = RandomPlacement.Generate(new Random(seed));
        var second = RandomPlacement.Generate(new Random(seed));

        Assert.Null(PlacementValidator.Validate(first));
        Assert.Equal(first, second);
    }

    [Fact]
    public void Seeds1000To9999_AllPassValidate()
    {
        for (int seed = 1000; seed < 10000; seed++)
        {
            var ships = RandomPlacement.Generate(new Random(seed));

            Assert.True(PlacementValidator.Validate(ships) == null,
                $"Seed {seed}: {PlacementValidator.Validate(ships)}");
        }
    }

    [Fact]
    public void UnseededRandom_GivesValidLayouts()
    {
        for (int i = 0; i < 1000; i++)
            Assert.Null(PlacementValidator.Validate(RandomPlacement.Generate(new Random())));
    }

    [Fact]
    public void SameRandomUsed1000Times_AlwaysGivesValidLayout()
    {
        var random = new Random(3);

        for (int i = 0; i < 1000; i++)
            Assert.Null(PlacementValidator.Validate(RandomPlacement.Generate(random)));
    }

    [Fact]
    public void SameRandomUsedTwice_GivesDifferentLayouts()
    {
        var random = new Random(7);

        var first = RandomPlacement.Generate(random);
        var second = RandomPlacement.Generate(random);

        Assert.NotEqual(Describe(first), Describe(second));
    }

    [Fact]
    public void EarlierCalls_DoNotChangeLaterLayouts()
    {
        var fresh = Describe(RandomPlacement.Generate(new Random(5)));

        for (int seed = 100; seed < 200; seed++)
            RandomPlacement.Generate(new Random(seed));

        Assert.Equal(fresh, Describe(RandomPlacement.Generate(new Random(5))));
    }

    [Fact]
    public void EachCall_ReturnsANewLayoutObject()
    {
        var first = RandomPlacement.Generate(new Random(9));
        var second = RandomPlacement.Generate(new Random(9));

        Assert.NotSame(first, second);
        Assert.NotSame(first[0], second[0]);
    }

    [Fact]
    public void Seeds0To999_HaveFourShips()
    {
        for (int seed = 0; seed < 1000; seed++)
            Assert.Equal(GameRules.ShipCount, RandomPlacement.Generate(new Random(seed)).Count);
    }

    [Fact]
    public void Seeds0To999_HaveFourCellsPerShip()
    {
        for (int seed = 0; seed < 1000; seed++)
        {
            foreach (var ship in RandomPlacement.Generate(new Random(seed)))
                Assert.Equal(GameRules.ShipLength, ship.Count);
        }
    }

    [Fact]
    public void Seeds0To999_KeepEveryCellOnTheGrid()
    {
        for (int seed = 0; seed < 1000; seed++)
        {
            foreach (var ship in RandomPlacement.Generate(new Random(seed)))
            {
                foreach (var cell in ship)
                {
                    Assert.InRange(cell.Row, 0, GameRules.GridSize - 1);
                    Assert.InRange(cell.Col, 0, GameRules.GridSize - 1);
                }
            }
        }
    }

    [Fact]
    public void Seeds0To999_NeverShareACell()
    {
        for (int seed = 0; seed < 1000; seed++)
        {
            var cells = new HashSet<Coord>();
            foreach (var ship in RandomPlacement.Generate(new Random(seed)))
                cells.UnionWith(ship);

            Assert.Equal(GameRules.ShipCount * GameRules.ShipLength, cells.Count);
        }
    }

    [Fact]
    public void Seeds0To999_KeepEveryShipStraightWithNoGap()
    {
        for (int seed = 0; seed < 1000; seed++)
        {
            foreach (var ship in RandomPlacement.Generate(new Random(seed)))
            {
                int rows = ship.Select(cell => cell.Row).Distinct().Count();
                int cols = ship.Select(cell => cell.Col).Distinct().Count();

                Assert.True(
                    (rows == 1 && cols == GameRules.ShipLength) ||
                    (cols == 1 && rows == GameRules.ShipLength),
                    $"Seed {seed}: {string.Join("", ship)}");
                Assert.Equal(GameRules.ShipLength - 1,
                    ship.Max(cell => cell.Row + cell.Col) - ship.Min(cell => cell.Row + cell.Col));
            }
        }
    }

    [Fact]
    public void Seeds0To999_UseBothDirectionsForEveryShip()
    {
        var horizontal = new int[GameRules.ShipCount];
        var vertical = new int[GameRules.ShipCount];
        for (int seed = 0; seed < 1000; seed++)
        {
            var ships = RandomPlacement.Generate(new Random(seed));
            for (int i = 0; i < ships.Count; i++)
            {
                if (ships[i][0].Row == ships[i][1].Row) horizontal[i]++;
                else vertical[i]++;
            }
        }

        for (int i = 0; i < GameRules.ShipCount; i++)
        {
            Assert.True(horizontal[i] > 250, $"Ship {i + 1}: only {horizontal[i]} horizontal in 1000.");
            Assert.True(vertical[i] > 250, $"Ship {i + 1}: only {vertical[i]} vertical in 1000.");
        }
    }

    // 8 lines x 5 starts x 2 directions = 80 places a ship can go.
    [Fact]
    public void Seeds0To999_UseEveryShipPosition()
    {
        var positions = new HashSet<string>();
        for (int seed = 0; seed < 1000; seed++)
        {
            foreach (var ship in RandomPlacement.Generate(new Random(seed)))
                positions.Add(string.Join("", ship.OrderBy(cell => cell.Row + cell.Col)));
        }

        int starts = GameRules.GridSize - GameRules.ShipLength + 1;
        Assert.Equal(GameRules.GridSize * starts * 2, positions.Count);
    }

    [Fact]
    public void Seeds0To999_SplitDirectionsAboutEvenly()
    {
        int horizontal = 0;
        for (int seed = 0; seed < 1000; seed++)
            horizontal += RandomPlacement.Generate(new Random(seed)).Count(IsHorizontal);

        Assert.InRange(horizontal, 1800, 2200);
    }

    [Fact]
    public void Seeds0To999_IncludeAllHorizontalAndAllVerticalFleets()
    {
        bool allHorizontal = false;
        bool allVertical = false;
        for (int seed = 0; seed < 1000; seed++)
        {
            int horizontal = RandomPlacement.Generate(new Random(seed)).Count(IsHorizontal);
            if (horizontal == GameRules.ShipCount) allHorizontal = true;
            if (horizontal == 0) allVertical = true;
        }

        Assert.True(allHorizontal);
        Assert.True(allVertical);
    }

    // More ship positions cover a middle cell than a corner cell.
    [Fact]
    public void Seeds0To999_UseTheMiddleMoreThanTheCorners()
    {
        var counts = new Dictionary<Coord, int>();
        for (int seed = 0; seed < 1000; seed++)
        {
            foreach (var ship in RandomPlacement.Generate(new Random(seed)))
            {
                foreach (var cell in ship)
                    counts[cell] = counts.GetValueOrDefault(cell) + 1;
            }
        }

        int last = GameRules.GridSize - 1;
        int middle = counts[new Coord(3, 3)];
        Assert.True(middle > counts[new Coord(0, 0)]);
        Assert.True(middle > counts[new Coord(0, last)]);
        Assert.True(middle > counts[new Coord(last, 0)]);
        Assert.True(middle > counts[new Coord(last, last)]);
    }

    [Fact]
    public void Seeds0To999_IncludeShipsThatTouch()
    {
        bool touching = false;
        for (int seed = 0; seed < 1000 && !touching; seed++)
        {
            var ships = RandomPlacement.Generate(new Random(seed));
            foreach (var a in ships[0])
            {
                foreach (var b in ships[1])
                {
                    if (Math.Abs(a.Row - b.Row) + Math.Abs(a.Col - b.Col) == 1) touching = true;
                }
            }
        }

        Assert.True(touching);
    }

    // Each ship takes three rolls: direction (0 is horizontal), which row or
    // column it lies on, and how far along it starts.
    [Fact]
    public void ScriptedRolls_PlaceShipsWhereTheRollsSay()
    {
        var random = new ScriptedRandom(
            0, 0, 0,
            1, 0, 4,
            0, 7, 4,
            1, 7, 0);

        var ships = RandomPlacement.Generate(random);

        Assert.Equal("[0,0][0,1][0,2][0,3]", string.Join("", ships[0]));
        Assert.Equal("[4,0][5,0][6,0][7,0]", string.Join("", ships[1]));
        Assert.Equal("[7,4][7,5][7,6][7,7]", string.Join("", ships[2]));
        Assert.Equal("[0,7][1,7][2,7][3,7]", string.Join("", ships[3]));
        Assert.Equal(0, random.Remaining);
    }

    [Fact]
    public void ScriptedOverlap_RollsThatShipAgain()
    {
        var random = new ScriptedRandom(
            0, 0, 0,
            1, 0, 0,    // column 0 from row 0: lands on ship 1
            0, 2, 4,
            1, 7, 4,
            0, 7, 0);

        var ships = RandomPlacement.Generate(random);

        Assert.Null(PlacementValidator.Validate(ships));
        Assert.Equal("[2,4][2,5][2,6][2,7]", string.Join("", ships[1]));
        Assert.Equal(0, random.Remaining);
    }

    [Fact]
    public void ScriptedRepeatedOverlap_KeepsRollingUntilTheShipFits()
    {
        var random = new ScriptedRandom(
            0, 3, 2,
            0, 3, 2,    // the same ship again
            1, 4, 0,    // crosses it at [3,4]
            0, 3, 4,    // shares [3,4] and [3,5]
            1, 0, 0,
            0, 5, 0,
            0, 6, 0);

        var ships = RandomPlacement.Generate(random);

        Assert.Null(PlacementValidator.Validate(ships));
        Assert.Equal("[0,0][1,0][2,0][3,0]", string.Join("", ships[1]));
        Assert.Equal(0, random.Remaining);
    }

    private static bool IsHorizontal(IReadOnlyList<Coord> ship) => ship[0].Row == ship[1].Row;

    private sealed class ScriptedRandom : Random
    {
        private readonly Queue<int> _rolls;

        public ScriptedRandom(params int[] rolls) => _rolls = new Queue<int>(rolls);

        public int Remaining => _rolls.Count;

        public override int Next(int maxValue) => _rolls.Dequeue();
    }

    private static string Describe(IReadOnlyList<IReadOnlyList<Coord>> ships) =>
        string.Join(" ", ships.Select(ship => string.Join("", ship)));
}

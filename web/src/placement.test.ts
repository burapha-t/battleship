// The same cases as tests/Battleship.Core.Tests/PlacementValidatorTests.cs,
// so the UI and the server agree on every rule and every message.

import { describe, expect, it } from 'vitest'
import type { Cell } from './protocol'
import { SHIP_LENGTH, randomPlacement, validatePlacement } from './placement'

// Four cells starting at (row, col), going right or down.
const ship = (row: number, col: number, horizontal = true): Cell[] =>
  Array.from({ length: SHIP_LENGTH }, (_, i): Cell => (horizontal ? [row, col + i] : [row + i, col]))

// Four horizontal ships on rows 0, 2, 4 and 6. Tests replace one of them.
const validFleet = (): (Cell[] | null)[] => [ship(0, 0), ship(2, 0), ship(4, 0), ship(6, 0)]

const withShip = (index: number, cells: Cell[] | null) => {
  const ships = validFleet()
  ships[index] = cells
  return ships
}

describe('validatePlacement', () => {
  it.each([
    ['horizontal fleet', validFleet()],
    ['mixed directions touching edges', [ship(0, 0, false), ship(4, 7, false), ship(7, 0), ship(0, 4)]],
    ['cells out of order', withShip(0, [[0, 3], [0, 1], [0, 2], [0, 0]])],
    ['protocol §5 example', [
      [[0, 0], [0, 1], [0, 2], [0, 3]],
      [[2, 1], [3, 1], [4, 1], [5, 1]],
      [[7, 0], [7, 1], [7, 2], [7, 3]],
      [[1, 6], [2, 6], [3, 6], [4, 6]],
    ] as Cell[][]],
    ['vertical fleet', [ship(0, 0, false), ship(0, 2, false), ship(4, 4, false), ship(4, 6, false)]],
    ['ships side by side', [ship(0, 0), ship(1, 0), ship(2, 0), ship(3, 0)]],
    ['ships end to end', [ship(0, 0), ship(0, 4), ship(7, 0), ship(7, 4)]],
    ['vertical cells out of order', withShip(3, [[6, 7], [4, 7], [7, 7], [5, 7]])],
  ])('accepts %s', (_name, ships) => {
    expect(validatePlacement(ships)).toBeNull()
  })

  it.each([
    [0, 4, true],
    [7, 4, true],
    [0, 7, false],
    [4, 4, false],
    [4, 7, false],
  ])('accepts a ship ending on the last row or col (%i, %i, horizontal %s)', (row, col, horizontal) => {
    expect(validatePlacement(withShip(0, ship(row, col, horizontal)))).toBeNull()
  })

  it.each([
    ['too few ships', validFleet().slice(0, 3)],
    ['too many ships', [...validFleet(), ship(7, 4)]],
    ['a null fleet', null],
    ['an empty fleet', []],
  ])('rejects %s', (_name, ships) => {
    expect(validatePlacement(ships)).toBe('Place exactly 4 ships.')
  })

  it.each([
    ['a ship with the wrong length', 1, [[2, 0], [2, 1], [2, 2]], 'Ship 2 must cover exactly 4 cells.'],
    ['a ship past the edge', 2, ship(4, 5), 'Ship 3 is off the grid.'],
    ['a ship with a negative cell', 0, ship(-1, 0, false), 'Ship 1 is off the grid.'],
    ['a bent ship', 1, [[2, 0], [2, 1], [2, 2], [3, 2]], 'Ship 2 is not in a straight line.'],
    ['a ship with a gap', 3, [[6, 0], [6, 1], [6, 2], [6, 4]], 'Ship 4 has a gap between its cells.'],
    ['overlapping ships', 1, ship(0, 3, false), 'Ship 2 uses a cell that is already taken.'],
    ['a ship repeating a cell', 0, [[0, 0], [0, 0], [0, 1], [0, 2]], 'Ship 1 uses a cell that is already taken.'],
    ['a null ship', 2, null, 'Ship 3 must cover exactly 4 cells.'],
    ['an empty ship', 0, [], 'Ship 1 must cover exactly 4 cells.'],
    ['a ship too long', 3, [[6, 0], [6, 1], [6, 2], [6, 3], [6, 4]], 'Ship 4 must cover exactly 4 cells.'],
    ['a diagonal ship', 1, [[2, 4], [3, 5], [4, 6], [5, 7]], 'Ship 2 is not in a straight line.'],
    ['a square ship', 2, [[4, 4], [4, 5], [5, 4], [5, 5]], 'Ship 3 is not in a straight line.'],
    ['a vertical ship with a gap', 0, [[0, 7], [1, 7], [2, 7], [4, 7]], 'Ship 1 has a gap between its cells.'],
    ['a ship split in two pairs', 3, [[6, 0], [6, 1], [6, 3], [6, 4]], 'Ship 4 has a gap between its cells.'],
    ['a gap with cells out of order', 3, [[6, 4], [6, 0], [6, 2], [6, 1]], 'Ship 4 has a gap between its cells.'],
    ['identical ships', 3, ship(0, 0), 'Ship 4 uses a cell that is already taken.'],
    ['ships sharing one end cell', 1, ship(0, 3), 'Ship 2 uses a cell that is already taken.'],
    ['a ship made of one cell', 0, [[0, 0], [0, 0], [0, 0], [0, 0]], 'Ship 1 uses a cell that is already taken.'],
  ] as [string, number, Cell[] | null, string][])('rejects %s', (_name, index, cells, message) => {
    expect(validatePlacement(withShip(index, cells))).toBe(message)
  })

  it.each([
    [0, 5, true],
    [5, 0, false],
    [0, -1, true],
    [-1, 0, false],
    [8, 0, true],
    [0, 8, false],
    [-1, 4, true],
    [4, -1, false],
  ])('rejects a ship off any edge (%i, %i, horizontal %s)', (row, col, horizontal) => {
    expect(validatePlacement(withShip(0, ship(row, col, horizontal)))).toBe('Ship 1 is off the grid.')
  })

  it.each([2 ** 31 - 1, -(2 ** 31)])('rejects a ship with a huge coordinate (%i)', (far) => {
    expect(validatePlacement(withShip(0, [[0, far], [0, 0], [0, 1], [0, 2]]))).toBe('Ship 1 is off the grid.')
  })

  it('rejects vertical ships sharing a cell', () => {
    const ships = validFleet()
    ships[2] = ship(0, 7, false)
    ships[3] = ship(3, 7, false)
    expect(validatePlacement(ships)).toBe('Ship 4 uses a cell that is already taken.')
  })

  it('reports the first of two bad ships', () => {
    const ships = validFleet()
    ships[1] = [[2, 0], [2, 1], [2, 2], [3, 2]]
    ships[3] = [[6, 0], [6, 1], [6, 2], [6, 4]]
    expect(validatePlacement(ships)).toBe('Ship 2 is not in a straight line.')
  })
})

describe('randomPlacement', () => {
  it('always builds a valid fleet', () => {
    for (let i = 0; i < 500; i++) expect(validatePlacement(randomPlacement())).toBeNull()
  })
})

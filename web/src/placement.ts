// A TypeScript copy of Battleship.Core's GameRules, PlacementValidator and
// RandomPlacement. Same rules, same messages. The server re-checks every
// placement, so this is a convenience for the player, never a trust boundary.

import type { Cell } from './protocol'

export const GRID_SIZE = 8
export const SHIP_LENGTH = 4
export const SHIP_COUNT = 4

type Fleet = readonly (readonly Cell[] | null | undefined)[] | null | undefined

/**
 * Returns null when the layout is valid, otherwise a sentence the player can
 * read. Ships are numbered from 1 in the order given; a ship's cells can be in
 * any order. Mirrors `PlacementValidator.Validate`.
 */
export function validatePlacement(ships: Fleet): string | null {
  if (!ships || ships.length !== SHIP_COUNT) return `Place exactly ${SHIP_COUNT} ships.`

  const taken = new Set<string>()
  for (let i = 0; i < ships.length; i++) {
    const ship = ships[i]
    const number = i + 1

    if (!ship || ship.length !== SHIP_LENGTH)
      return `Ship ${number} must cover exactly ${SHIP_LENGTH} cells.`

    if (!ship.every(isOnGrid)) return `Ship ${number} is off the grid.`

    for (const [row, col] of ship) {
      const key = `${row},${col}`
      if (taken.has(key)) return `Ship ${number} uses a cell that is already taken.`
      taken.add(key)
    }

    const sameRow = ship.every((cell) => cell[0] === ship[0][0])
    const sameCol = ship.every((cell) => cell[1] === ship[0][1])
    if (!sameRow && !sameCol) return `Ship ${number} is not in a straight line.`

    // The cells are distinct and share a row or column, so they are side by
    // side exactly when the two ends are SHIP_LENGTH - 1 apart.
    const along = ship.map((cell) => (sameRow ? cell[1] : cell[0]))
    if (Math.max(...along) - Math.min(...along) !== SHIP_LENGTH - 1)
      return `Ship ${number} has a gap between its cells.`
  }

  return null
}

/** C# coordinates are ints; here a fraction counts as off the grid too. */
function isOnGrid([row, col]: Cell): boolean {
  return (
    Number.isInteger(row) && Number.isInteger(col) &&
    row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE
  )
}

/** Display labels only: columns A–H, rows 1–8. The wire is always 0-based. */
export const colName = (col: number) => String.fromCharCode(65 + col)
export const cellName = ([row, col]: Cell) => `${colName(col)}${row + 1}`

/** The SHIP_LENGTH cells from `start`, going right or down. */
export function shipAt([row, col]: Cell, horizontal: boolean): Cell[] {
  return Array.from({ length: SHIP_LENGTH }, (_, i): Cell =>
    horizontal ? [row, col + i] : [row + i, col],
  )
}

/** A random layout that passes `validatePlacement`. Mirrors `RandomPlacement.Generate`. */
export function randomPlacement(random: () => number = Math.random): Cell[][] {
  const pick = (n: number) => Math.floor(random() * n)
  const ships: Cell[][] = []
  const taken = new Set<string>()

  // Three ships cover 12 cells, and blocking both halves of every row takes
  // 16, so there is always room and the loop ends.
  while (ships.length < SHIP_COUNT) {
    const horizontal = pick(2) === 0
    const across = pick(GRID_SIZE)
    const along = pick(GRID_SIZE - SHIP_LENGTH + 1)
    const ship = shipAt(horizontal ? [across, along] : [along, across], horizontal)
    if (ship.some(([r, c]) => taken.has(`${r},${c}`))) continue
    ship.forEach(([r, c]) => taken.add(`${r},${c}`))
    ships.push(ship)
  }
  return ships
}

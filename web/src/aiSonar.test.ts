import { describe, expect, it } from 'vitest'
import { isUsefulRegion, suggestSonarRegions } from './aiSonar'
import type { Cell } from './protocol'

const key = ([row, col]: [number, number]) => `${row},${col}`

// Every 2x2 window on the 8x8 board, so the whole candidate set comes back.
const ALL_WINDOWS = 49

// A 4-cell ship on row 2, sunk by its last hit.
const SHIP: Cell[] = [[2, 2], [2, 3], [2, 4], [2, 5]]
const SUNK_SHIP_SHOTS = [
  { row: 2, col: 2, result: 'hit' as const },
  { row: 2, col: 3, result: 'hit' as const },
  { row: 2, col: 4, result: 'hit' as const },
  { row: 2, col: 5, result: 'hit' as const, sunkCells: SHIP },
]

describe('AI Sonar', () => {
  it('may use an existing hit as evidence, but every region still has an unshot cell', () => {
    const shots = [
      { row: 3, col: 3, result: 'hit' as const },
      { row: 5, col: 5, result: 'hit' as const },
    ]
    const attempted = new Set(shots.map((shot) => `${shot.row},${shot.col}`))
    const regions = suggestSonarRegions(shots)

    expect(regions.length).toBeGreaterThan(0)
    for (const region of regions) {
      expect(region.cells.some((cell) => !attempted.has(key(cell)))).toBe(true)
    }
  })

  it('never returns a region where every cell was already fired at', () => {
    const shots = [
      { row: 3, col: 3, result: 'hit' as const },
      { row: 4, col: 3, result: 'hit' as const },
      { row: 3, col: 4, result: 'hit' as const },
      { row: 4, col: 4, result: 'hit' as const },
    ]
    const attempted = new Set(shots.map((shot) => `${shot.row},${shot.col}`))
    const regions = suggestSonarRegions(shots, ALL_WINDOWS)

    for (const region of regions) {
      expect(region.cells.every((cell) => attempted.has(key(cell)))).toBe(false)
    }
  })

  it('never returns a region containing a known miss', () => {
    const shots = [
      { row: 0, col: 0, result: 'miss' as const },
      { row: 3, col: 4, result: 'miss' as const },
      { row: 6, col: 6, result: 'miss' as const },
    ]
    const misses = new Set(shots.map((shot) => `${shot.row},${shot.col}`))
    const regions = suggestSonarRegions(shots, ALL_WINDOWS)

    expect(regions.length).toBeGreaterThan(0)
    for (const region of regions) {
      expect(region.cells.some((cell) => misses.has(key(cell)))).toBe(false)
    }
  })

  it('never returns a region containing a sunk ship cell', () => {
    const sunk = new Set(SHIP.map(key))
    const regions = suggestSonarRegions(SUNK_SHIP_SHOTS, ALL_WINDOWS)

    expect(regions.length).toBeGreaterThan(0)
    for (const region of regions) {
      expect(region.cells.some((cell) => sunk.has(key(cell)))).toBe(false)
    }
  })

  it('returns no regions when all 64 cells have already been fired at', () => {
    const shots = Array.from({ length: 64 }, (_, i) => ({
      row: Math.floor(i / 8),
      col: i % 8,
      result: 'hit' as const,
    }))

    expect(suggestSonarRegions(shots)).toEqual([])
  })
})

describe('isUsefulRegion', () => {
  const region: Cell[] = [[1, 2], [2, 2], [1, 3], [2, 3]]

  it('is false once every cell has been attempted', () => {
    const shots = region.map(([row, col]) => ({ row, col, result: 'hit' as const }))

    expect(isUsefulRegion(region, shots)).toBe(false)
  })

  it('is false once a cell is a known miss', () => {
    expect(isUsefulRegion(region, [{ row: 1, col: 2, result: 'miss' as const }])).toBe(false)
  })

  it('is false once a cell belongs to a sunk ship', () => {
    expect(isUsefulRegion(region, SUNK_SHIP_SHOTS)).toBe(false)
  })

  it('is true with an old unresolved hit and at least one unshot cell', () => {
    expect(isUsefulRegion(region, [{ row: 1, col: 2, result: 'hit' as const }])).toBe(true)
  })
})

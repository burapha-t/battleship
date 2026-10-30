import { describe, expect, it } from 'vitest'
import { suggestSonarRegions } from './aiSonar'

const key = ([row, col]: [number, number]) => `${row},${col}`

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
    const regions = suggestSonarRegions(shots, 8)

    for (const region of regions) {
      expect(region.cells.every((cell) => attempted.has(key(cell)))).toBe(false)
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

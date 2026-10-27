import { describe, expect, it } from 'vitest'
import type { Shot } from '../state/gameReducer'
import { consecutiveHits } from './streak'

const shot = (by: string, result: 'hit' | 'miss', auto = false): Shot => ({
  type: 'fireResult',
  by,
  target: by === 'me' ? 'opponent' : 'me',
  row: 0,
  col: 0,
  result,
  sunk: false,
  sunkCells: null,
  allSunk: false,
  auto,
})

describe('hit streaks', () => {
  it('hits in a row build the streak', () => {
    expect(consecutiveHits([shot('me', 'hit')], 'me')).toBe(1)
    expect(consecutiveHits([shot('me', 'hit'), shot('me', 'hit'), shot('me', 'hit')], 'me')).toBe(3)
  })

  it("counts only the player's own shots across alternating turns", () => {
    const shots = [shot('me', 'hit'), shot('opponent', 'miss'), shot('me', 'hit'), shot('opponent', 'hit'), shot('me', 'hit')]
    expect(consecutiveHits(shots, 'me')).toBe(3)
    expect(consecutiveHits(shots, 'opponent')).toBe(1)
  })

  it('a miss resets it, an opponent miss does not', () => {
    expect(consecutiveHits([shot('me', 'hit'), shot('me', 'hit'), shot('me', 'miss')], 'me')).toBe(0)
    expect(consecutiveHits([shot('me', 'hit'), shot('me', 'miss'), shot('opponent', 'miss'), shot('me', 'hit')], 'me')).toBe(1)
    expect(consecutiveHits([shot('me', 'hit'), shot('opponent', 'miss'), shot('me', 'hit')], 'me')).toBe(2)
  })

  it('a timeout auto-shot resets it, even when it hits', () => {
    expect(consecutiveHits([shot('me', 'hit'), shot('me', 'hit'), shot('me', 'hit', true)], 'me')).toBe(0)
    expect(consecutiveHits([shot('me', 'hit'), shot('me', 'miss', true), shot('me', 'hit')], 'me')).toBe(1)
  })

  it('starts each match empty', () => {
    expect(consecutiveHits([], 'me')).toBe(0)
    expect(consecutiveHits([shot('me', 'hit')], null)).toBe(0)
  })
})

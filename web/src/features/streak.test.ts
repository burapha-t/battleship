import { describe, expect, it } from 'vitest'
import type { Shot } from '../gameReducer'
import { consecutiveHits } from './streak'
const shot = (by: string, result: 'hit' | 'miss'): Shot => ({ type: 'fireResult', by, target: by === 'me' ? 'opponent' : 'me', row: 0, col: 0, result, sunk: false, sunkCells: null, allSunk: false, auto: false })
describe('hit streaks', () => {
  it('counts only the player’s shots across alternating turns', () => {
    expect(consecutiveHits([shot('me', 'hit'), shot('opponent', 'miss'), shot('me', 'hit'), shot('opponent', 'hit'), shot('me', 'hit')], 'me')).toBe(3)
  })
  it('resets after the player misses, but not after an opponent miss', () => {
    expect(consecutiveHits([shot('me', 'hit'), shot('me', 'hit'), shot('me', 'miss'), shot('opponent', 'miss'), shot('me', 'hit')], 'me')).toBe(1)
  })
  it('starts each match empty', () => { expect(consecutiveHits([], 'me')).toBe(0) })
})

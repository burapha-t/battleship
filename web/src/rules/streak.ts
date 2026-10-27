// Hit streaks (#40), counted on the web from `fireResult`; the server knows
// nothing about them. Started from feat/extra-features-ui's streak.ts.

import type { Shot } from '../state/gameReducer'

/** Hits in a row before the badge, the streak sound and the ×2 level. */
export const STREAK_MIN = 2

/**
 * `playerId`'s own hits in a row at the end of `shots`. The opponent's shots
 * in between don't count. A miss or a timeout auto-shot (`auto`, even one
 * that hits) resets it.
 */
export function consecutiveHits(shots: Shot[], playerId: string | null): number {
  let streak = 0
  for (const shot of shots) {
    if (shot.by === playerId) streak = shot.result === 'hit' && !shot.auto ? streak + 1 : 0
  }
  return streak
}

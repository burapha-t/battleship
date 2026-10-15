import type { Shot } from '../gameReducer'

export function consecutiveHits(shots: Shot[], playerId: string | null): number {
  let streak = 0
  for (const shot of shots) {
    if (shot.by === playerId) streak = shot.result === 'hit' ? streak + 1 : 0
  }
  return streak
}

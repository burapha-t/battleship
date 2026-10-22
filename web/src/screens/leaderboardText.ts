// Shared catalogue adapter (#38) and wins formatting for leaderboard/PR #65.

import type { Language } from '../settings'
import { translator } from '../translations'

export const leaderboardText = (language: Language) => translator(language, 'leaderboard')

/** 11 → "11 wins", 1 → "1 win"; Thai "ชนะ 11 ครั้ง". */
export function wins(points: number, language: Language): string {
  return translator(language, 'game')(points === 1 ? 'winsOne' : 'winsMany', { count: points })
}

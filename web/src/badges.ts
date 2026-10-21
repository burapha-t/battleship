// Badge catalogue (#41): the 15 codes in tier order and how each medal looks.
// The server decides who earns what (Achievements in Battleship.Core); the UI
// only draws it. Text lives in screens/badgesText.ts.

import type { AchievementsView } from './protocol'

export type BadgeGroup = 'wins' | 'accuracy' | 'streak'

export const GROUPS: readonly BadgeGroup[] = ['wins', 'accuracy', 'streak']

/** Wins: total wins reach it. Accuracy: one match strictly over it. Streak: one match's best run reaches it. */
const TIERS: Record<BadgeGroup, number[]> = {
  wins: [5, 10, 20, 50, 100],
  accuracy: [40, 50, 60, 70, 80],
  streak: [4, 6, 8, 10, 12],
}

const COLOURS: Record<BadgeGroup, string[]> = {
  wins: ['#FFF1C2', '#FFE08A', '#FFC83D', '#F2A81D', '#D98A0B'],
  accuracy: ['#CFE8FB', '#9CCDF3', '#5AAEEB', '#2F8FE0', '#1E6FBF'],
  streak: ['#FFD3CF', '#FFA9A3', '#FF7A70', '#FF4F5E', '#D9283A'],
}

/** From this tier on the medal is dark enough to need white text. */
const WHITE_FROM: Record<BadgeGroup, number> = { wins: 4, accuracy: 3, streak: 3 }

export type Badge = { code: string; group: BadgeGroup; tier: number; number: string; colour: string; white: boolean }

export const BADGES: Badge[] = GROUPS.flatMap((group) =>
  TIERS[group].map((tier, i) => ({
    code: `${group}-${tier}`,
    group,
    tier,
    number: group === 'accuracy' ? `${tier}%` : group === 'streak' ? `×${tier}` : String(tier),
    colour: COLOURS[group][i],
    white: i >= WHITE_FROM[group],
  })),
)

/** One group of the badges screen: my stat, how many I own, and the next one to earn. */
export type GroupProgress = {
  group: BadgeGroup
  /** Total wins, best match accuracy, or best streak. */
  value: number
  earned: number
  /** The lowest tier I don't own yet; null once I own all five. */
  next: Badge | null
  /** `value` toward `next`, 0..1; 1 when all are owned. */
  fraction: number
}

export function groupProgress(group: BadgeGroup, view: AchievementsView): GroupProgress {
  const owned = new Set(view.badges.map((b) => b.code))
  const tiers = BADGES.filter((b) => b.group === group)
  const value = group === 'wins' ? view.wins : group === 'accuracy' ? view.bestAccuracy : view.bestStreak
  const next = tiers.find((b) => !owned.has(b.code)) ?? null
  return {
    group,
    value,
    earned: tiers.filter((b) => owned.has(b.code)).length,
    next,
    fraction: next ? Math.min(1, Math.max(0, value / next.tier)) : 1,
  }
}

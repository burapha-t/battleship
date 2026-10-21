// Profile (#42): the rules for my unsaved choices. The server checks them again
// on `profileUpdate`; these only keep the screen from offering what it would refuse.

import { BADGES } from './badges'
import type { ProfileView } from './protocol'

/** Badges shown at most. */
export const MAX_SHOWN = 3

/**
 * Picks or unpicks `code`. Only an earned badge can be picked, and only while
 * fewer than 3 are; picking adds it at the end, so the order is the order I chose.
 */
export function toggleBadge(shown: string[], code: string, earned: readonly string[]): string[] {
  if (shown.includes(code)) return shown.filter((c) => c !== code)
  if (!earned.includes(code) || !BADGES.some((b) => b.code === code)) return shown
  return shown.length < MAX_SHOWN ? [...shown, code] : shown
}

/** My choices differ from the saved profile; order counts. */
export function profileDirty(profile: ProfileView, avatar: string, shown: string[]): boolean {
  return (
    avatar !== profile.avatar ||
    shown.length !== profile.shownBadges.length ||
    shown.some((code, i) => code !== profile.shownBadges[i])
  )
}

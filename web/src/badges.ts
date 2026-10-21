// Badge catalogue (#41): all tier codes, labels and colours live here.
import type { Language } from './settings'
import type { ProfileView } from './protocol'

export const BADGES = [
  ...[5, 10, 20, 50, 100].map((n, i) => ({ code: `wins-${n}`, group: 'wins' as const, number: String(n), colour: ['#FFF1C2', '#FFE08A', '#FFC83D', '#F2A81D', '#D98A0B'][i], white: i === 4, en: `${n} wins`, th: `ชนะ ${n} ครั้ง` })),
  ...[40, 50, 60, 70, 80].map((n, i) => ({ code: `accuracy-${n}`, group: 'accuracy' as const, number: `${n}%`, colour: ['#CFE8FB', '#9CCDF3', '#5AAEEB', '#2F8FE0', '#1E6FBF'][i], white: i >= 3, en: `Over ${n}%`, th: `มากกว่า ${n}%` })),
  ...[4, 6, 8, 10, 12].map((n, i) => ({ code: `streak-${n}`, group: 'streak' as const, number: `×${n}`, colour: ['#FFD3CF', '#FFA9A3', '#FF7A70', '#FF4F5E', '#D9283A'][i], white: i >= 3, en: `${n} in a row`, th: `ยิงโดนติดกัน ${n} ครั้ง` })),
]
export function badgeLabel(code: string, language: Language): string {
  const badge = BADGES.find(b => b.code === code)
  return badge ? badge[language] : code
}
export function toggleBadge(shown: string[], code: string, earned: readonly string[]): string[] {
  if (!earned.includes(code) || !BADGES.some(b => b.code === code)) return shown
  if (shown.includes(code)) return shown.filter(c => c !== code)
  return shown.length < 3 ? [...shown, code] : shown
}
export function profileDirty(profile: ProfileView, avatar: string, shown: string[]): boolean {
  return avatar !== profile.avatar || shown.length !== profile.shownBadges.length || shown.some((code, i) => code !== profile.shownBadges[i])
}
// Temporary until login (#46) supplies an explicit account state.
export function editableProfile(profile: ProfileView): boolean {
  return profile.avatar !== '' || profile.badges.length > 0 || profile.wins > 0 || profile.bestAccuracy > 0 || profile.bestStreak > 0
}

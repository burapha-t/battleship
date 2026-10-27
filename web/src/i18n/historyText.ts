// Shared catalogue adapter (#38) and date/percentage formatting for history.
// Keep historyText/Language compatible with the pending profile/badges PR #65.

import type { Language } from '../settings/settings'
import { translator } from './translations'
export type { Language } from '../settings/settings'

export const historyText = (language: Language) => translator(language, 'history')

/** 66.7 → "66.7%", 50 → "50.0%". */
export function percent(value: number, language: Language): string {
  return `${new Intl.NumberFormat(locale(language), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)}%`
}

/** UTC ISO time → local "Oct 19, 14:31", with the year when it isn't this year. */
export function localTime(iso: string, language: Language, now = new Date()): string {
  const date = new Date(iso)
  return new Intl.DateTimeFormat(locale(language), {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
}

function locale(language: Language): string {
  return language === 'th' ? 'th-TH' : 'en-US'
}

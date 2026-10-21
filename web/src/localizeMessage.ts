// #38: translate server error codes and existing stored messages at render time.
// Game state and protocol frames retain their original values when language changes.
import type { Language } from './settings'
import { translations, translator } from './translations'

function parameters(template: string, message: string): Record<string, string> | null {
  const names: string[] = []
  const pattern = template.split(/(\{\w+\})/).map(part => {
    if (/^\{\w+\}$/.test(part)) { names.push(part.slice(1, -1)); return '(.+)' }
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }).join('')
  const match = new RegExp(`^${pattern}$`).exec(message)
  return match ? Object.fromEntries(names.map((name, i) => [name, match[i + 1]])) : null
}

export function localizePlacement(message: string | null, language: Language): string | null {
  if (message === null || language === 'en') return message
  const t = translator(language, 'placement')
  for (const key of Object.keys(translations.placement) as (keyof typeof translations.placement)[]) {
    const values = parameters(translations.placement[key][0], message)
    if (values) return t(key, values)
  }
  return translator(language, 'errors')('invalid-placement')
}

export function localizeError(error: { code: string; message: string }, language: Language): string {
  if (language === 'en') return error.message
  if (error.code === 'invalid-placement') return localizePlacement(error.message, language)!
  const t = translator(language, 'errors')
  // Known reasons preserve useful detail; unfamiliar reasons fall back to the code.
  if (error.code === 'unknown' || error.code === 'invalid-profile') {
    for (const key of Object.keys(translations.errors) as (keyof typeof translations.errors)[]) {
      if (translations.errors[key][0] === error.message) return t(key)
    }
  }
  return t(Object.hasOwn(translations.errors, error.code) ? error.code as keyof typeof translations.errors : 'unknown')
}

/** Notices and the fatal version mismatch were already stored as English sentences. */
export function localizeMessage(message: string, language: Language): string {
  if (language === 'en') return message
  const t = translator(language, 'game')
  for (const key of ['protocolMismatch', 'reset', 'leftGame'] as const) {
    const values = parameters(translations.game[key][0], message)
    if (values) return t(key, values)
  }
  return translator(language, 'errors')('unknown')
}

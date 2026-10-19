/** Device-local settings for #43. No account or server is needed. */
export type Language = 'en' | 'th'
export type Settings = { language: Language; musicVolume: number; effectsVolume: number }
const keys = { language: 'battleship.language', musicVolume: 'battleship.music-volume', effectsVolume: 'battleship.effects-volume' }
function read(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
export function volume(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.round(Math.max(0, Math.min(100, value))) : fallback
}
function savedVolume(key: string, fallback: number): number {
  const value = read(key)
  return value === null || value.trim() === '' ? fallback : volume(Number(value), fallback)
}
const savedLanguage = read(keys.language)?.replaceAll('"', '')
const legacyMuted = read('battleship.muted') === '1'
let settings: Settings = {
  language: savedLanguage === 'en' || savedLanguage === 'th' ? savedLanguage : typeof navigator !== 'undefined' && navigator.language.startsWith('th') ? 'th' : 'en',
  musicVolume: savedVolume(keys.musicVolume, legacyMuted ? 0 : 70),
  effectsVolume: savedVolume(keys.effectsVolume, legacyMuted ? 0 : 85),
}
const listeners = new Set<() => void>()
export const getSettings = () => settings
export function subscribeSettings(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export function updateSettings(patch: Partial<Settings>) {
  settings = { ...settings, ...patch,
    musicVolume: volume(patch.musicVolume ?? settings.musicVolume, settings.musicVolume),
    effectsVolume: volume(patch.effectsVolume ?? settings.effectsVolume, settings.effectsVolume),
  }
  try {
    for (const key of Object.keys(keys) as (keyof Settings)[]) localStorage.setItem(keys[key], String(settings[key]))
    localStorage.setItem('battleship.muted', settings.musicVolume === 0 && settings.effectsVolume === 0 ? '1' : '0')
  } catch { /* Preferences still work when browser storage is blocked. */ }
  listeners.forEach(listener => listener())
}

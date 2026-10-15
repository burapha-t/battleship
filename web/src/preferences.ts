import { createContext, useContext } from 'react'
export type Language = 'en' | 'th'
export type PreferencesValue = {
  language: Language
  setLanguage: (value: Language) => void
  effects: boolean
  toggleEffects: () => void
  music: boolean
  toggleMusic: () => void
  streaks: boolean
  toggleStreaks: () => void
  t: (en: string, th?: string) => string
}
export const Preferences = createContext<PreferencesValue>({ language: 'en', setLanguage: () => {}, effects: true, toggleEffects: () => {}, music: false, toggleMusic: () => {}, streaks: true, toggleStreaks: () => {}, t: en => en })
export const usePreferences = () => useContext(Preferences)
export function readPreference<T>(key: string, fallback: T): T {
  try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value) as T } catch { return fallback }
}
export function savePreference(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* Storage may be unavailable. */ }
}

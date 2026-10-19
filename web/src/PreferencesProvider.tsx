import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Preferences, readPreference, savePreference } from './preferences'
import type { Language } from './preferences'
import { isMuted, setMuted, setMusic, setSoundVolumes } from './sound'

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [language, updateLanguage] = useState<Language>(() => readPreference<string>('battleship.language', 'en') === 'th' ? 'th' : 'en')
  const [effects, updateEffects] = useState(() => !isMuted())
  const [music, updateMusic] = useState(() => readPreference<boolean>('battleship.music', false) === true)
  const [musicVolume, updateMusicVolume] = useState(() => Math.min(100, Math.max(0, Number(readPreference('battleship.music-volume', 70)) || 0)))
  const [effectsVolume, updateEffectsVolume] = useState(() => Math.min(100, Math.max(0, Number(readPreference('battleship.effects-volume', 85)) || 0)))
  const [streaks, updateStreaks] = useState(() => readPreference<boolean>('battleship.streaks', true) !== false)
  useEffect(() => { document.documentElement.lang = language; savePreference('battleship.language', language) }, [language])
  useEffect(() => {
    setMusic(music)
    savePreference('battleship.music', music)
    return () => setMusic(false)
  }, [music])
  useEffect(() => {
    setSoundVolumes(musicVolume / 100, effectsVolume / 100)
    savePreference('battleship.music-volume', musicVolume)
    savePreference('battleship.effects-volume', effectsVolume)
  }, [musicVolume, effectsVolume])
  const setMusicVolume = (value: number) => { updateMusicVolume(value); updateMusic(value > 0) }
  const setEffectsVolume = (value: number) => { updateEffectsVolume(value); updateEffects(value > 0); setMuted(value === 0) }
  const toggleEffects = () => updateEffects(value => { setMuted(value); return !value })
  const toggleStreaks = () => updateStreaks(value => { savePreference('battleship.streaks', !value); return !value })
  return <Preferences.Provider value={{ musicVolume: music ? musicVolume : 0, effectsVolume: effects ? effectsVolume : 0, setMusicVolume, setEffectsVolume, language, setLanguage: updateLanguage, effects, toggleEffects, music, toggleMusic: () => updateMusic(value => !value), streaks, toggleStreaks, t: (en, th) => language === 'th' && th ? th : en }}>{children}</Preferences.Provider>
}

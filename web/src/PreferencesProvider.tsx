import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Preferences, readPreference, savePreference } from './preferences'
import type { Language } from './preferences'
import { isMuted, setMuted, setMusic } from './sound'

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [language, updateLanguage] = useState<Language>(() => readPreference<string>('battleship.language', 'en') === 'th' ? 'th' : 'en')
  const [effects, updateEffects] = useState(() => !isMuted())
  const [music, updateMusic] = useState(() => readPreference<boolean>('battleship.music', false) === true)
  const [streaks, updateStreaks] = useState(() => readPreference<boolean>('battleship.streaks', true) !== false)
  useEffect(() => { document.documentElement.lang = language; savePreference('battleship.language', language) }, [language])
  useEffect(() => {
    setMusic(music)
    savePreference('battleship.music', music)
    return () => setMusic(false)
  }, [music])
  const toggleEffects = () => updateEffects(value => { setMuted(value); return !value })
  const toggleStreaks = () => updateStreaks(value => { savePreference('battleship.streaks', !value); return !value })
  return <Preferences.Provider value={{ language, setLanguage: updateLanguage, effects, toggleEffects, music, toggleMusic: () => updateMusic(value => !value), streaks, toggleStreaks, t: (en, th) => language === 'th' && th ? th : en }}>{children}</Preferences.Provider>
}

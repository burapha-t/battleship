// In-game language (#38): one hook per screen, using the existing settings store.
import { translator } from './translations'
import type { TranslationScope } from './translations'
import { useSettings } from '../settings/useSettings'
export function useTranslation<S extends TranslationScope>(scope: S) {
  const { language } = useSettings()
  return { language, t: translator(language, scope) }
}

import { localizeMessage } from '../i18n/localizeMessage'
import { useTranslation } from '../i18n/useTranslation'
import { useState } from 'react'
import type { GameState } from '../state/gameReducer'

/** "Bob left the game" / "The server was reset", over any screen until dismissed. */
export function Notice({ notice }: { notice: GameState['notice'] }) {
  const { language, t } = useTranslation('game')
  const [dismissed, setDismissed] = useState<GameState['notice']>(null)
  if (!notice || notice === dismissed) return null
  return (
    <div className="notice" role="status">
      {localizeMessage(notice.text, language)}
      <button type="button" aria-label={t('dismiss')} onClick={() => setDismissed(notice)}>
        ✕
      </button>
    </div>
  )
}

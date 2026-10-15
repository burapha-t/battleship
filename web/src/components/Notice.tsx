import { localizeMessage } from '../localizeMessage'
import { usePreferences } from '../preferences'
import { useState } from 'react'
import type { GameState } from '../gameReducer'

/** "Bob left the game" / "The server was reset", over any screen until dismissed. */
export function Notice({ notice }: { notice: GameState['notice'] }) {
  const { t, language } = usePreferences()
  const [dismissed, setDismissed] = useState<GameState['notice']>(null)
  if (!notice || notice === dismissed) return null
  return (
    <div className="notice" role="status">
      {localizeMessage(notice.text, language)}
      <button type="button" aria-label={t('Dismiss', 'ปิด')} onClick={() => setDismissed(notice)}>
        ✕
      </button>
    </div>
  )
}

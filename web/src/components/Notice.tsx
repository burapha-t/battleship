import { useState } from 'react'
import type { GameState } from '../gameReducer'

/** "Bob left the game" / "The server was reset", over any screen until dismissed. */
export function Notice({ notice }: { notice: GameState['notice'] }) {
  const [dismissed, setDismissed] = useState<GameState['notice']>(null)
  if (!notice || notice === dismissed) return null
  return (
    <div className="notice" role="status">
      {notice.text}
      <button type="button" aria-label="Dismiss" onClick={() => setDismissed(notice)}>
        ✕
      </button>
    </div>
  )
}

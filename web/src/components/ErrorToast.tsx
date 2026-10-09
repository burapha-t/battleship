import { useEffect, useState } from 'react'
import type { GameState } from '../gameReducer'

const SHOW_MS = 4000

/** Shows each server `error` message for a few seconds. */
export function ErrorToast({ error }: { error: GameState['lastError'] }) {
  const [hidden, setHidden] = useState<GameState['lastError']>(null)

  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => setHidden(error), SHOW_MS)
    return () => clearTimeout(timer)
  }, [error])

  if (!error || error === hidden) return null
  return (
    <div key={error.seq} className="toast" role="alert">
      {error.message}
    </div>
  )
}

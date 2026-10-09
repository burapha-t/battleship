// Offline replay (`?replay=p1`): plays one player's side of the golden
// transcript instead of opening a socket, so the UI can be built and checked
// with no server running.

import transcript from '../../tests/fixtures/match-transcript.jsonl?raw'
import type { GameAction } from './gameReducer'
import type { ClientVerb, ServerEvent } from './protocol'

const DELAY_MS = 350

type Line = { from: string; to: string; frame: ServerEvent | ClientVerb }

/**
 * Every frame the server sent to `player`, in order. The player's own `place`
 * lines become the `myShips` action at the point they were sent, so the game
 * screen can draw that player's fleet.
 */
export function replayActions(player: string): GameAction[] {
  const actions: GameAction[] = []
  for (const text of transcript.split('\n')) {
    if (!text.trim()) continue
    const { from, to, frame } = JSON.parse(text) as Line
    if (to === player) actions.push(frame as ServerEvent)
    else if (from === player && frame.type === 'place') actions.push({ type: 'myShips', ships: frame.ships })
  }
  return actions
}

/** Feeds `replayActions(player)` to `onAction`, one every DELAY_MS. Returns a stop function. */
export function startReplay(player: string, onAction: (action: GameAction) => void): () => void {
  const actions = replayActions(player)
  if (actions.length === 0) console.warn(`[replay] the transcript has no lines for "${player}"`)
  let next = 0
  const timer = setInterval(() => {
    if (next < actions.length) onAction(actions[next++])
    else {
      clearInterval(timer)
      console.info('[replay] finished')
    }
  }, DELAY_MS)
  return () => clearInterval(timer)
}

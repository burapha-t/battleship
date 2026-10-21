// Offline replay (`?replay=p1`): plays one player's side of the golden
// transcript instead of opening a socket, so the UI can be built and checked
// with no server running.

import transcript from '../../tests/fixtures/match-transcript.jsonl?raw'
import { END_DELAY_MS } from './endDelay'
import type { GameAction } from './gameReducer'
import type { ClientVerb, ServerEvent } from './protocol'

const DELAY_MS = 350
/** How long the end screen shows before the transcript's rematch. */
const END_SCREEN_MS = 3000

type Line = { example?: boolean; from: string; to: string; frame: ServerEvent | ClientVerb }

/**
 * Every frame the server sent to `player`, in order. The player's own `place`
 * lines become the `myShips` action at the point they were sent, so the game
 * screen can draw that player's fleet.
 */
export function replayActions(player: string): GameAction[] {
  const actions: GameAction[] = []
  for (const text of transcript.split('\n')) {
    if (!text.trim()) continue
    const { example, from, to, frame } = JSON.parse(text) as Line
    if (example) continue
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
  let timer: ReturnType<typeof setTimeout>
  const step = () => {
    if (next >= actions.length) {
      console.info('[replay] finished')
      return
    }
    const action = actions[next++]
    onAction(action)
    // After a win, wait out the final-board pause and leave the end screen up for a bit.
    timer = setTimeout(step, action.type === 'matchEnd' ? END_DELAY_MS + END_SCREEN_MS : DELAY_MS)
  }
  timer = setTimeout(step, DELAY_MS)
  return () => clearTimeout(timer)
}

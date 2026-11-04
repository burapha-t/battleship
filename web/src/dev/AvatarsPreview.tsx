// Dev page at ?preview=avatars (#77): saved profile pictures on Home, and with
// ?preview=avatars-placement / avatars-game on both players during a match.
// Alice (me) has the shark, Mira the octopus; Bob is a guest (a letter) and
// Ghost Fleet keeps its mascot. No server needed.

import { Header } from '../components/Header'
import { initialState } from '../state/gameReducer'
import type { GameState } from '../state/gameReducer'
import type { Cell, PlayerInfo } from '../protocol'
import { GameScreen } from '../screens/GameScreen'
import { LobbyScreen } from '../screens/LobbyScreen'
import { PlacementScreen } from '../screens/PlacementScreen'

const PLAYERS: PlayerInfo[] = [
  { id: 'p1', name: 'Alice', score: 1, avatar: 'shark' },
  { id: 'p2', name: 'Mira', score: 0, avatar: 'octopus' },
]

const SHIPS: Cell[][] = [
  [[0, 1], [0, 2], [0, 3], [0, 4]],
  [[2, 6], [3, 6], [4, 6], [5, 6]],
  [[4, 0], [5, 0], [6, 0], [7, 0]],
  [[7, 3], [7, 4], [7, 5], [7, 6]],
]

const HOME: GameState = {
  ...initialState,
  screen: 'lobby',
  myId: 'p1',
  myName: 'Alice',
  myScore: 1,
  lobby: [
    { id: 'p1', name: 'Alice', status: 'idle', avatar: 'shark' },
    { id: 'p2', name: 'Mira', status: 'idle', avatar: 'octopus' },
    { id: 'p3', name: 'Bob', status: 'searching', avatar: '' },
    { id: 'p4', name: 'Ghost Fleet', status: 'idle', avatar: '' },
  ],
}

const PLACEMENT: GameState = { ...HOME, screen: 'placement', players: PLAYERS, placed: ['p2'] }

const GAME: GameState = {
  ...PLACEMENT,
  screen: 'game',
  myShips: SHIPS,
  placed: ['p1', 'p2'],
  turn: { activePlayerId: 'p1', seconds: 10, turnNumber: 3 },
}

const log = (what: string) => () => console.info(`[preview] ${what}`)

export function AvatarsPreview({ mode }: { mode: string }) {
  const state = mode === 'avatars-placement' ? PLACEMENT : mode === 'avatars-game' ? GAME : HOME
  return (
    <div className="app">
      <svg className="waves" viewBox="0 0 1280 110" preserveAspectRatio="none" aria-hidden>
        <path d="M0 40 Q 80 10 160 40 T 320 40 T 480 40 T 640 40 T 800 40 T 960 40 T 1120 40 T 1280 40 V110 H0Z" fill="#9CCDF3" />
        <path d="M0 68 Q 80 42 160 68 T 320 68 T 480 68 T 640 68 T 800 68 T 960 68 T 1120 68 T 1280 68 V110 H0Z" fill="#2F8FE0" stroke="#14325A" strokeWidth="3" />
      </svg>
      <Header state={state} nav={null} onOpenSettings={log('settings')} />
      {state === HOME ? (
        <LobbyScreen state={state} publicSearching={false} onStartGame={log('start')} onStartGhost={log('ghost')}
          ghostStarting={false} onCancelSearch={log('cancel')} />
      ) : state === PLACEMENT ? (
        <PlacementScreen state={state} onReady={log('ready')} />
      ) : (
        <GameScreen state={state} onFire={log('fire')} />
      )}
    </div>
  )
}

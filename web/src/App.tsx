import { useEffect, useReducer, useRef } from 'react'
import { saveMatchHistory } from './aiClient'
import { ErrorToast } from './components/ErrorToast'
import { Header } from './components/Header'
import { LinkBanner } from './components/LinkBanner'
import { Notice } from './components/Notice'
import { gameReducer, initialState } from './gameReducer'
import type { GameState } from './gameReducer'
import type { Cell, ClientVerb } from './protocol'
import { EndScreen } from './screens/EndScreen'
import { GameScreen } from './screens/GameScreen'
import { LobbyScreen } from './screens/LobbyScreen'
import { NicknameScreen } from './screens/NicknameScreen'
import { PlacementScreen } from './screens/PlacementScreen'
import { useGameSocket } from './useGameSocket'

/** One reducer over the server's events, and a switch over its screen. */
export default function App() {
  const [state, dispatch] = useReducer(gameReducer, initialState)
  const { send, link } = useGameSocket(dispatch)
  const savedMatches = useRef(new Set<string>())

  // AI training data stays local. We save only this player's own placement and
  // shots after a completed match; hidden opponent coordinates are never read.
  useEffect(() => {
    if (
      state.screen !== 'end' ||
      !state.matchId ||
      !state.myName ||
      !state.myId ||
      !state.myShips ||
      savedMatches.current.has(state.matchId)
    ) return

    savedMatches.current.add(state.matchId)
    const myShots = state.shots
      .filter((shot) => shot.by === state.myId)
      .map((shot) => ({ row: shot.row, col: shot.col, result: shot.result }))

    void saveMatchHistory({
      playerName: state.myName,
      matchId: state.matchId,
      ships: state.myShips,
      shots: myShots,
      won: state.winnerId === state.myId,
    }).catch((error) => {
      // AI extras must never break the base game.
      console.warn(error)
      savedMatches.current.delete(state.matchId!)
    })
  }, [state])

  return (
    <div className="app">
      <svg className="waves" viewBox="0 0 1280 110" preserveAspectRatio="none" aria-hidden>
        <path d="M0 40 Q 80 10 160 40 T 320 40 T 480 40 T 640 40 T 800 40 T 960 40 T 1120 40 T 1280 40 V110 H0Z" fill="#9CCDF3" />
        <path d="M0 68 Q 80 42 160 68 T 320 68 T 480 68 T 640 68 T 800 68 T 960 68 T 1120 68 T 1280 68 V110 H0Z" fill="#2F8FE0" stroke="#14325A" strokeWidth="3" />
      </svg>
      <Header state={state} />
      <LinkBanner link={link} connected={state.myId !== null} />
      <Notice notice={state.notice} />
      {state.fatal ? (
        <main className="card fatal" role="alert">
          <h2>Can't play</h2>
          <p>{state.fatal}</p>
        </main>
      ) : (
        <Screen state={state} send={send} placeShips={(ships) => {
          // The server never sends my ships back, so keep the ones I send.
          dispatch({ type: 'myShips', ships })
          send({ type: 'place', ships })
        }} />
      )}
      <ErrorToast error={state.lastError} />
    </div>
  )
}

type ScreenProps = { state: GameState; send: (verb: ClientVerb) => void; placeShips: (ships: Cell[][]) => void }

function Screen({ state, send, placeShips }: ScreenProps) {
  switch (state.screen) {
    case 'connecting':
    case 'nickname':
      return (
        <NicknameScreen
          connected={state.screen === 'nickname'}
          lastError={state.lastError}
          onJoin={(nickname) => send({ type: 'join', nickname })}
        />
      )
    case 'lobby':
      return <LobbyScreen state={state} onStartGame={() => send({ type: 'findMatch' })} />
    case 'placement':
      return <PlacementScreen state={state} onReady={placeShips} />
    case 'game':
      return <GameScreen state={state} onFire={([row, col]) => send({ type: 'fire', row, col })} />
    case 'end':
      return <EndScreen state={state} onRematch={() => send({ type: 'rematch' })} />
  }
}

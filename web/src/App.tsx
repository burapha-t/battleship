import { useReducer, useState } from 'react'
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
import { LoginScreen } from './screens/LoginScreen'
import { PlacementScreen } from './screens/PlacementScreen'
import { useGameSocket } from './useGameSocket'
import type { Link } from './useGameSocket'

/** One reducer over the server's events, and a switch over its screen. */
export default function App() {
  const [state, dispatch] = useReducer(gameReducer, initialState)
  const { send, link } = useGameSocket(dispatch)
  // The login screen outlives `welcome` until its loading bar has finished.
  const [boarded, setBoarded] = useState(false)
  const atLogin = state.screen === 'connecting' || state.screen === 'login' || (state.screen === 'lobby' && !boarded)

  return (
    <div className="app">
      <svg className="waves" viewBox="0 0 1280 110" preserveAspectRatio="none" aria-hidden>
        <path d="M0 40 Q 80 10 160 40 T 320 40 T 480 40 T 640 40 T 800 40 T 960 40 T 1120 40 T 1280 40 V110 H0Z" fill="#9CCDF3" />
        <path d="M0 68 Q 80 42 160 68 T 320 68 T 480 68 T 640 68 T 800 68 T 960 68 T 1120 68 T 1280 68 V110 H0Z" fill="#2F8FE0" stroke="#14325A" strokeWidth="3" />
      </svg>
      {(!atLogin || state.fatal) && <Header state={state} />}
      <LinkBanner link={link} connected={state.myId !== null} />
      <Notice notice={state.notice} />
      {state.fatal ? (
        <main className="card fatal" role="alert">
          <h2>Can't play</h2>
          <p>{state.fatal}</p>
        </main>
      ) : (
        <Screen
          state={state}
          link={link}
          atLogin={atLogin}
          send={send}
          onBoarded={() => setBoarded(true)}
          placeShips={(ships) => {
            // The server never sends my ships back, so keep the ones I send.
            dispatch({ type: 'myShips', ships })
            send({ type: 'place', ships })
          }}
          goHome={() => {
            // The server answers `leave` with no event of its own; go home locally.
            send({ type: 'leave' })
            dispatch({ type: 'wentHome' })
          }}
        />
      )}
      {/* Login errors show inline on the card. */}
      <ErrorToast error={atLogin ? null : state.lastError} />
    </div>
  )
}

type ScreenProps = {
  state: GameState
  link: Link
  atLogin: boolean
  send: (verb: ClientVerb) => void
  onBoarded: () => void
  placeShips: (ships: Cell[][]) => void
  goHome: () => void
}

function Screen({ state, link, atLogin, send, onBoarded, placeShips, goHome }: ScreenProps) {
  const login = (
    <LoginScreen
      connected={state.screen !== 'connecting'}
      lastError={state.lastError}
      welcomedAs={state.myName}
      onLogin={(username, password) => send({ type: 'login', username, password })}
      onSignup={(username, password) => send({ type: 'signup', username, password })}
      onBoarded={onBoarded}
    />
  )

  switch (state.screen) {
    case 'connecting':
    case 'login':
      return login
    case 'lobby':
      return atLogin ? (
        login
      ) : (
        <LobbyScreen state={state} connected={link === 'open'} onStartGame={() => send({ type: 'findMatch' })} />
      )
    case 'placement':
      return <PlacementScreen state={state} onReady={placeShips} />
    case 'game':
      return <GameScreen state={state} onFire={([row, col]) => send({ type: 'fire', row, col })} />
    case 'end':
      return <EndScreen state={state} onRematch={() => send({ type: 'rematch' })} onHome={goHome} />
  }
}

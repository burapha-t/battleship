import { useEffect, useReducer, useState } from 'react'
import { accountRequest } from './auth'
import type { Account } from './auth'
import { AuthScreen } from './screens/AuthScreen'
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
  const [account, setAccount] = useState<Account | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const replay = new URLSearchParams(window.location.search).has('replay')
  useEffect(() => {
    if (replay) return
    let active = true
    accountRequest<Account | null>('me').then(user => { if (active) setAccount(user) })
      .catch(() => { /* Login form provides a retry and a specific error on submit. */ })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [replay])
  useEffect(() => {
    if (!account) return
    const check = () => { accountRequest<Account | null>('me').then(user => { if (!user) setAccount(null) }).catch(() => {}) }
    const timer = window.setInterval(check, 30000)
    window.addEventListener('focus', check)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', check) }
  }, [account])
  const logout = async () => {
    setBusy(true); setError('')
    try { await accountRequest('logout', {}); setAccount(null) }
    catch { setError('Could not log out. Check the server and try again.') }
    finally { setBusy(false) }
  }
  if (replay) return <GameApp />
  if (loading) return <div className="app"><p role="status">Checking your account…</p></div>
  if (!account) return <div className="app"><header className="header"><div className="logo"><b>Battle</b>ship</div></header><AuthScreen onLogin={setAccount} /></div>
  return <>
    <div className="account-bar"><span>Signed in as {account.displayName}</span><button className="btn white small" disabled={busy} onClick={logout}>{busy ? 'Logging out…' : 'Log out'}</button>{error && <span role="alert">{error}</span>}</div>
    <GameApp key={account.id} nickname={account.displayName} />
  </>
}

function GameApp({ nickname = '' }: { nickname?: string }) {
  const [state, dispatch] = useReducer(gameReducer, initialState)
  const { send, link } = useGameSocket(dispatch)

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
        <Screen nickname={nickname} state={state} send={send} placeShips={(ships) => {
          // The server never sends my ships back, so keep the ones I send.
          dispatch({ type: 'myShips', ships })
          send({ type: 'place', ships })
        }} />
      )}
      {state.lastError?.code === 'account-unavailable' && <p className="card" role="alert">{state.lastError.message}</p>}
      <ErrorToast error={state.lastError} />
    </div>
  )
}

type ScreenProps = { nickname: string; state: GameState; send: (verb: ClientVerb) => void; placeShips: (ships: Cell[][]) => void }

function Screen({ nickname, state, send, placeShips }: ScreenProps) {
  switch (state.screen) {
    case 'connecting':
    case 'nickname':
      return (
        <NicknameScreen
          initialNickname={nickname}
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

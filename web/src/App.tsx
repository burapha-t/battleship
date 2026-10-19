import { localizeMessage } from './localizeMessage'
import { useEffect, useReducer, useState } from 'react'
import { usePreferences } from './preferences'
import { PreferencesProvider } from './PreferencesProvider'
import { HistoryScreen, LeaderboardScreen, LoginScreen, SettingsModal, UtilityNavigation } from './features/FeatureScreens'
import { ProfileScreen } from './features/ProfileScreen'
import type { Page } from './features/FeatureScreens'
import { StreakNotification } from './features/StreakNotification'
import { ErrorToast } from './components/ErrorToast'
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
import './features/redesign.css'
import { useGameSocket } from './useGameSocket'

/** One reducer over the server's events, and a switch over its screen. */
export default function App() {
  return <PreferencesProvider><GameApp /></PreferencesProvider>
}

function GameApp() {
  const { t, language } = usePreferences()
  const [page, setPage] = useState<Page>('play')
  const [profile, setProfile] = useState<{ name: string; guest: boolean } | null>(() => {
    if (new URLSearchParams(window.location.search).has('replay')) return { name: 'Replay', guest: true }
    try {
      const raw = sessionStorage.getItem('battleship.return-home')
      const saved = raw ? JSON.parse(raw) : null
      if (saved && typeof saved.name === 'string' && saved.name.trim() && saved.name.length <= 16 && typeof saved.guest === 'boolean') return saved
    } catch { /* Returning home still works when browser storage is blocked. */ }
    return null
  })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [state, dispatch] = useReducer(gameReducer, initialState)
  const { send, link } = useGameSocket(dispatch)
  useEffect(() => { try { sessionStorage.removeItem('battleship.return-home') } catch {} }, [])
  const returnHome = () => {
    try { sessionStorage.setItem('battleship.return-home', JSON.stringify({ name: state.myName ?? profile?.name ?? 'Captain', guest: profile?.guest ?? true })) } catch {}
    window.location.reload()
  }

  return (
    <div className={`app redesign ${!profile ? 'auth-view' : page === 'play' ? `stage-${state.screen}` : `page-${page}`}`}>
      <svg className="waves" viewBox="0 0 1280 110" preserveAspectRatio="none" aria-hidden>
        <path d="M0 40 Q 80 10 160 40 T 320 40 T 480 40 T 640 40 T 800 40 T 960 40 T 1120 40 T 1280 40 V110 H0Z" fill="#9CCDF3" />
        <path d="M0 68 Q 80 42 160 68 T 320 68 T 480 68 T 640 68 T 800 68 T 960 68 T 1120 68 T 1280 68 V110 H0Z" fill="#2F8FE0" stroke="#14325A" strokeWidth="3" />
      </svg>
      <div className="bubbles" aria-hidden><span /><span /><span /><span /><span /></div>
      <UtilityNavigation page={page} stage={state.screen} authenticated={profile !== null} online={state.lobby.length} onNavigate={setPage} onSettings={() => setSettingsOpen(true)} onLogout={() => window.location.reload()} />
      {page === 'play' && profile && <LinkBanner link={link} connected={state.myId !== null} />}
      <StreakNotification state={state} preview={0} />
      <Notice notice={state.notice} />
      {page === 'leaderboard' ? <LeaderboardScreen name={state.myName ?? profile?.name ?? 'Alice'} /> : page === 'profile' ? <ProfileScreen key={state.myName ?? profile?.name ?? 'preview'} name={state.myName ?? profile?.name ?? 'Alice'} /> : page === 'history' ? <HistoryScreen name={state.myName ?? profile?.name ?? 'Alice'} /> : null}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      <div className="play-content" hidden={page !== 'play'}>
      {!profile ? <LoginScreen onEnter={(name, guest) => setProfile({ name, guest })} /> : state.fatal ? (
        <main className="card fatal" role="alert">
          <h2>{t("Can't play", 'ไม่สามารถเล่นได้')}</h2>
          <p>{localizeMessage(state.fatal, language)}</p>
        </main>
      ) : (
        <Screen onHome={returnHome} initialNickname={profile.name} state={state} send={send} placeShips={(ships) => {
          // The server never sends my ships back, so keep the ones I send.
          dispatch({ type: 'myShips', ships })
          send({ type: 'place', ships })
        }} />
      )}
      </div>
      <ErrorToast error={state.lastError} />
    </div>
  )
}

type ScreenProps = { onHome: () => void; initialNickname: string; state: GameState; send: (verb: ClientVerb) => void; placeShips: (ships: Cell[][]) => void }

function Screen({ onHome, initialNickname, state, send, placeShips }: ScreenProps) {
  switch (state.screen) {
    case 'connecting':
    case 'nickname':
      return (
        <NicknameScreen
          initialNickname={initialNickname}
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
      return <EndScreen onHome={onHome} state={state} onRematch={() => send({ type: 'rematch' })} />
  }
}

import { localizeMessage } from './localizeMessage'
import { useReducer, useState } from 'react'
import { usePreferences } from './preferences'
import { PreferencesProvider } from './PreferencesProvider'
import { LeaderboardScreen, LoginScreen, Navigation, SettingsScreen } from './features/FeatureScreens'
import { ProfileScreen } from './features/ProfileScreen'
import type { Page } from './features/FeatureScreens'
import { StreakNotification } from './features/StreakNotification'
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
  return <PreferencesProvider><GameApp /></PreferencesProvider>
}

function GameApp() {
  const { t, language, setLanguage } = usePreferences()
  const [page, setPage] = useState<Page>('play')
  const [profile, setProfile] = useState<{ name: string; guest: boolean } | null>(() => new URLSearchParams(window.location.search).has('replay') ? { name: 'Replay', guest: true } : null)
  const [previewStreak, setPreviewStreak] = useState(0)
  const [state, dispatch] = useReducer(gameReducer, initialState)
  const { send, link } = useGameSocket(dispatch)

  return (
    <div className="app">
      <svg className="waves" viewBox="0 0 1280 110" preserveAspectRatio="none" aria-hidden>
        <path d="M0 40 Q 80 10 160 40 T 320 40 T 480 40 T 640 40 T 800 40 T 960 40 T 1120 40 T 1280 40 V110 H0Z" fill="#9CCDF3" />
        <path d="M0 68 Q 80 42 160 68 T 320 68 T 480 68 T 640 68 T 800 68 T 960 68 T 1120 68 T 1280 68 V110 H0Z" fill="#2F8FE0" stroke="#14325A" strokeWidth="3" />
      </svg>
      <Header state={state} />
      <div className="account-tools"><span>{profile ? `${profile.name} · ${profile.guest ? t('Guest', 'ผู้เยี่ยมชม') : t('Demo profile', 'โปรไฟล์ตัวอย่าง')}` : t('Welcome to the fleet', 'ยินดีต้อนรับสู่กองเรือ')}</span><button type="button" className="btn white small" onClick={() => setLanguage(language === 'en' ? 'th' : 'en')}>{language === 'en' ? 'ไทย' : 'English'}</button>{profile && state.myName === null && <button type="button" className="text-button" onClick={() => { setProfile(null); setPage('play') }}>{t('Leave profile', 'ออกจากโปรไฟล์')}</button>}</div>
      <Navigation page={page} onNavigate={setPage} />
      {page === 'play' && profile && <LinkBanner link={link} connected={state.myId !== null} />}
      <StreakNotification state={state} preview={page === 'settings' ? previewStreak : 0} />
      <Notice notice={state.notice} />
      {page === 'leaderboard' ? <LeaderboardScreen /> : page === 'profile' ? <ProfileScreen key={state.myName ?? profile?.name ?? 'preview'} name={state.myName ?? profile?.name ?? null} guest={profile?.guest ?? false} onPlay={() => setPage('play')} /> : page === 'settings' ? <SettingsScreen onPreviewStreak={() => setPreviewStreak(value => value + 1)} /> : null}
      <div className="play-content" hidden={page !== 'play'}>
      {!profile ? <LoginScreen onEnter={(name, guest) => setProfile({ name, guest })} /> : state.fatal ? (
        <main className="card fatal" role="alert">
          <h2>{t("Can't play", 'ไม่สามารถเล่นได้')}</h2>
          <p>{localizeMessage(state.fatal, language)}</p>
        </main>
      ) : (
        <Screen initialNickname={profile.name} state={state} send={send} placeShips={(ships) => {
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

type ScreenProps = { initialNickname: string; state: GameState; send: (verb: ClientVerb) => void; placeShips: (ships: Cell[][]) => void }

function Screen({ initialNickname, state, send, placeShips }: ScreenProps) {
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
      return <EndScreen state={state} onRematch={() => send({ type: 'rematch' })} />
  }
}

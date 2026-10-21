import { useEffect, useReducer, useState } from 'react'
import { ErrorToast } from './components/ErrorToast'
import { Header } from './components/Header'
import { LinkBanner } from './components/LinkBanner'
import { Notice } from './components/Notice'
import { SettingsModal } from './components/SettingsModal'
import { useEndDelay } from './endDelay'
import { gameReducer, initialState } from './gameReducer'
import type { BadgesAction, GameState, HistoryAction, LeaderboardAction, ProfileAction } from './gameReducer'
import type { Cell, ClientVerb } from './protocol'
import { BadgesScreen } from './screens/BadgesScreen'
import { EndScreen } from './screens/EndScreen'
import { GameScreen } from './screens/GameScreen'
import { HistoryScreen } from './screens/HistoryScreen'
import { LeaderboardScreen } from './screens/LeaderboardScreen'
import { LobbyScreen } from './screens/LobbyScreen'
import { NicknameScreen } from './screens/NicknameScreen'
import { PlacementScreen } from './screens/PlacementScreen'
import { ProfileScreen } from './screens/ProfileScreen'
import { setScene } from './sound'
import { useGameSocket } from './useGameSocket'

/** One reducer over the server's events, and a switch over its screen. */
export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [state, dispatch] = useReducer(gameReducer, initialState)
  const { send, link } = useGameSocket(dispatch)
  const screen = useEndDelay(state.screen)

  // Full music on the nickname and home screens, lowered once a match begins.
  useEffect(() => {
    setScene(screen === 'end' ? 'result' : screen === 'placement' || screen === 'game' ? 'match' : 'menu')
  }, [screen])

  return (
    <div className="app">
      <svg className="waves" viewBox="0 0 1280 110" preserveAspectRatio="none" aria-hidden>
        <path d="M0 40 Q 80 10 160 40 T 320 40 T 480 40 T 640 40 T 800 40 T 960 40 T 1120 40 T 1280 40 V110 H0Z" fill="#9CCDF3" />
        <path d="M0 68 Q 80 42 160 68 T 320 68 T 480 68 T 640 68 T 800 68 T 960 68 T 1120 68 T 1280 68 V110 H0Z" fill="#2F8FE0" stroke="#14325A" strokeWidth="3" />
      </svg>
      <Header state={state} onOpenSettings={() => setSettingsOpen(true)} />
      <LinkBanner link={link} connected={state.myId !== null} />
      <Notice notice={state.notice} />
      {state.fatal ? (
        <main className="card fatal" role="alert">
          <h2>Can't play</h2>
          <p>{state.fatal}</p>
        </main>
      ) : (
        <Screen state={{ ...state, screen }} send={send} dispatch={dispatch} placeShips={(ships) => {
          // The server never sends my ships back, so keep the ones I send.
          dispatch({ type: 'myShips', ships })
          send({ type: 'place', ships })
        }} goHome={() => {
          // The server answers `leave` with no event of its own; go home locally.
          send({ type: 'leave' })
          dispatch({ type: 'wentHome' })
        }} />
      )}
      <ErrorToast error={state.lastError} />
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}

type ScreenProps = {
  state: GameState
  send: (verb: ClientVerb) => void
  dispatch: (action: HistoryAction | LeaderboardAction | BadgesAction | ProfileAction) => void
  placeShips: (ships: Cell[][]) => void
  goHome: () => void
}

function Screen({ state, send, dispatch, placeShips, goHome }: ScreenProps) {
  const openHistory = () => {
    dispatch({ type: 'openHistory' })
    send({ type: 'historyList', page: 1 })
  }
  const loadMore = () => {
    if (!state.history?.more || state.history.loadingMore) return
    dispatch({ type: 'loadMoreHistory' })
    send({ type: 'historyList', page: state.history.page + 1 })
  }
  const openLeaderboard = () => {
    dispatch({ type: 'openLeaderboard' })
    send({ type: 'leaderboardGet' })
  }
  const openBadges = () => {
    dispatch({ type: 'openBadges' })
    send({ type: 'achievementsGet' })
  }
  // The profile shows my badges too, so it asks for both.
  const openProfile = () => {
    dispatch({ type: 'openProfile' })
    send({ type: 'profileGet' })
    send({ type: 'achievementsGet' })
  }

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
      return (
        <LobbyScreen
          state={state}
          onStartGame={() => send({ type: 'findMatch' })}
          onOpenHistory={openHistory}
          onOpenLeaderboard={openLeaderboard}
          onOpenBadges={openBadges}
          onOpenProfile={openProfile}
        />
      )
    case 'history':
      return (
        <HistoryScreen
          history={state.history}
          failed={state.historyFailed}
          onBack={() => dispatch({ type: 'closeHistory' })}
          onLoadMore={loadMore}
          onRetry={state.history ? loadMore : openHistory}
        />
      )
    case 'leaderboard':
      return (
        <LeaderboardScreen
          rows={state.leaderboard}
          failed={state.leaderboardFailed}
          myName={state.myName}
          onHome={() => dispatch({ type: 'closeLeaderboard' })}
          onRetry={openLeaderboard}
        />
      )
    case 'badges':
      return (
        <BadgesScreen
          achievements={state.achievements}
          failed={state.achievementsFailed}
          onBack={() => dispatch({ type: 'closeBadges' })}
          onRetry={openBadges}
        />
      )
    case 'profile':
      return (
        <ProfileScreen
          profile={state.profile}
          achievements={state.achievements}
          failed={state.profileFailed}
          saving={state.profileSaving}
          myName={state.myName}
          onHome={() => dispatch({ type: 'closeProfile' })}
          onRetry={openProfile}
          onSave={(avatar, shownBadges) => {
            dispatch({ type: 'saveProfile' })
            send({ type: 'profileUpdate', avatar, shownBadges })
          }}
        />
      )
    case 'placement':
      return <PlacementScreen state={state} onReady={placeShips} />
    case 'game':
      return <GameScreen state={state} onFire={([row, col]) => send({ type: 'fire', row, col })} />
    case 'end':
      return (
        <EndScreen
          state={state}
          onRematch={() => send({ type: 'rematch' })}
          onHome={goHome}
        />
      )
  }
}

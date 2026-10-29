import { useEffect, useReducer, useState } from 'react'
import { ErrorToast } from './components/ErrorToast'
import { Header } from './components/Header'
import { LinkBanner } from './components/LinkBanner'
import { Notice } from './components/Notice'
import { QuitGameModal } from './components/QuitGameModal'
import { SettingsModal } from './components/SettingsModal'
import { useEndDelay } from './state/endDelay'
import { canQuitGhostMatch, gameReducer, initialState } from './state/gameReducer'
import type { BadgesAction, GameState, HistoryAction, LeaderboardAction, ProfileAction } from './state/gameReducer'
import type { Cell, ClientCommand as ClientVerb, LobbyClient } from './protocol'
import { BadgesScreen } from './screens/BadgesScreen'
import { EndScreen } from './screens/EndScreen'
import { GameScreen } from './screens/GameScreen'
import { HistoryScreen } from './screens/HistoryScreen'
import { LeaderboardScreen } from './screens/LeaderboardScreen'
import { LobbyScreen } from './screens/LobbyScreen'
import { LoginScreen } from './screens/LoginScreen'
import { NicknameScreen } from './screens/NicknameScreen'
import { PlacementScreen } from './screens/PlacementScreen'
import { ProfileScreen } from './screens/ProfileScreen'
import { setScene } from './sound/sound'
import { localizeMessage } from './i18n/localizeMessage'
import { useTranslation } from './i18n/useTranslation'
import { useGameSocket } from './state/useGameSocket'

/** One reducer over the server's events, and a switch over its screen. */
export default function App() {
  const { language, t } = useTranslation('game')
  useEffect(() => { document.documentElement.lang = language }, [language])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [quitOpen, setQuitOpen] = useState(false)
  const [state, dispatch] = useReducer(gameReducer, initialState)
  const [ghostLaunching, setGhostLaunching] = useState(false)
  const { send, link } = useGameSocket((event) => {
    if (['ghostMode', 'matchStart', 'error', 'reset', 'opponentLeft'].includes(event.type)) setGhostLaunching(false)
    if (['matchEnd', 'reset', 'opponentLeft'].includes(event.type)) setQuitOpen(false)
    dispatch(event)
  })
  const screen = useEndDelay(state.screen)
  const canQuitGhost = canQuitGhostMatch(state)
  // The lobby list I had when I pressed Start game. Until the server sends a
  // new one, trust the press; after that, trust my status in the list.
  const [pressedAt, setPressedAt] = useState<LobbyClient[] | null>(null)
  const myStatus = state.lobby.find((c) => c.id === state.myId)?.status
  const ghostStarting = screen === 'lobby' && (ghostLaunching || state.gameMode === 'bot')
  const publicSearching = state.gameMode !== 'bot' && !ghostStarting
    && (myStatus === 'searching' || pressedAt === state.lobby)
  const searching = ghostStarting || publicSearching

  const openHistory = () => {
    dispatch({ type: 'openHistory' })
    send({ type: 'historyList', page: 1 })
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
  const open = { history: openHistory, leaderboard: openLeaderboard, badges: openBadges, profile: openProfile }

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
      <Header
        state={state}
        nav={!state.fatal && screen === 'lobby'
          ? { disabled: searching, onHistory: openHistory, onLeaderboard: openLeaderboard, onBadges: openBadges, onProfile: openProfile }
          : null}
        onQuitGame={canQuitGhost ? () => setQuitOpen(true) : undefined}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <LinkBanner link={link} connected={state.myId !== null} />
      <Notice notice={state.notice} />
      {state.fatal ? (
        <main className="card fatal" role="alert">
          <h2>{t('cantPlay')}</h2>
          <p>{localizeMessage(state.fatal, language)}</p>
        </main>
      ) : (
        <Screen state={{ ...state, screen }} send={send} dispatch={dispatch} open={open}
          publicSearching={publicSearching} ghostStarting={ghostStarting} startGhost={() => {
          setGhostLaunching(true)
          send({ type: 'playGhost' })
        }} startGame={() => {
          setPressedAt(state.lobby)
          send({ type: 'findMatch' })
        }} cancelSearch={() => {
          send({ type: 'cancelSearch' })
        }} placeShips={(ships) => {
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
      {quitOpen && canQuitGhost && (
        <QuitGameModal
          onClose={() => setQuitOpen(false)}
          onConfirm={() => {
            setQuitOpen(false)
            send({ type: 'quitGhost' })
          }}
        />
      )}
    </div>
  )
}

type ScreenProps = {
  state: GameState
  send: (verb: ClientVerb) => void
  dispatch: (action: HistoryAction | LeaderboardAction | BadgesAction | ProfileAction) => void
  /** Opens (or retries) the lobby's screens. */
  open: { history: () => void; leaderboard: () => void; badges: () => void; profile: () => void }
  publicSearching: boolean
  startGame: () => void
  startGhost: () => void
  ghostStarting: boolean
  cancelSearch: () => void
  placeShips: (ships: Cell[][]) => void
  goHome: () => void
}

function Screen({ state, send, dispatch, open, publicSearching, startGame, startGhost, ghostStarting, cancelSearch, placeShips, goHome }: ScreenProps) {
  // The login card comes first; "Play as guest" swaps in the nickname card.
  const [guest, setGuest] = useState(false)
  const loadMore = () => {
    if (!state.history?.more || state.history.loadingMore) return
    dispatch({ type: 'loadMoreHistory' })
    send({ type: 'historyList', page: state.history.page + 1 })
  }

  switch (state.screen) {
    case 'connecting':
    case 'nickname':
      return guest ? (
        <NicknameScreen
          connected={state.screen === 'nickname'}
          lastError={state.lastError}
          onJoin={(nickname) => send({ type: 'join', nickname })}
          onLogin={() => setGuest(false)}
        />
      ) : (
        <LoginScreen
          connected={state.screen === 'nickname'}
          lastError={state.lastError}
          onSend={(mode, username, password) => send({ type: mode, username, password })}
          onGuest={() => setGuest(true)}
        />
      )
    case 'lobby':
      return (
        <LobbyScreen state={state} publicSearching={publicSearching} onStartGame={startGame}
          onStartGhost={startGhost} ghostStarting={ghostStarting} onCancelSearch={cancelSearch} />
      )
    case 'history':
      return (
        <HistoryScreen
          history={state.history}
          failed={state.historyFailed}
          onBack={() => dispatch({ type: 'closeHistory' })}
          onLoadMore={loadMore}
          onRetry={state.history ? loadMore : open.history}
        />
      )
    case 'leaderboard':
      return (
        <LeaderboardScreen
          rows={state.leaderboard}
          failed={state.leaderboardFailed}
          myName={state.myName}
          onHome={() => dispatch({ type: 'closeLeaderboard' })}
          onRetry={open.leaderboard}
        />
      )
    case 'badges':
      return (
        <BadgesScreen
          achievements={state.achievements}
          failed={state.achievementsFailed}
          onBack={() => dispatch({ type: 'closeBadges' })}
          onRetry={open.badges}
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
          onRetry={open.profile}
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

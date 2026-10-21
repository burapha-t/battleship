// The UI's single source of truth: a pure fold over the server's events. The
// server is authoritative, so the only local actions are `myShips` — the ships I
// sent in `place`, which the server never sends back — `wentHome`, opening,
// paging and closing the match history screen, opening and closing the
// leaderboard and the badges screen, and opening, saving and closing the profile.

import { PROTOCOL_VERSION, assertNever } from './protocol'
import type { AchievementsView, BadgeUnlock, Cell, ErrorCode, HistoryMatch, HistoryStats, LeaderboardRow, LobbyClient, PlayerInfo, ProfileView, ServerEvent } from './protocol'

export type Screen = 'connecting' | 'nickname' | 'lobby' | 'history' | 'leaderboard' | 'badges' | 'profile' | 'placement' | 'game' | 'end'

export type Shot = Extract<ServerEvent, { type: 'fireResult' }>
export type Turn = Omit<Extract<ServerEvent, { type: 'turn' }>, 'type'>

export type MyShipsAction = { type: 'myShips'; ships: Cell[][] }
/** I pressed Home on the end screen. */
export type WentHomeAction = { type: 'wentHome' }
/** Match history: open it from the lobby (I send `historyList` page 1), ask for the next page, go back. */
export type HistoryAction = { type: 'openHistory' } | { type: 'loadMoreHistory' } | { type: 'closeHistory' }
/** Leaderboard: open it from the lobby (I send `leaderboardGet`), or again to retry; go back. */
export type LeaderboardAction = { type: 'openLeaderboard' } | { type: 'closeLeaderboard' }
/** Badges (#41): open them from the lobby (I send `achievementsGet`), or again to retry; go back. */
export type BadgesAction = { type: 'openBadges' } | { type: 'closeBadges' }
/**
 * Profile (#42): open it from the lobby (I send `profileGet` and
 * `achievementsGet`), or again to retry; Save (I send `profileUpdate`); go back.
 */
export type ProfileAction = { type: 'openProfile' } | { type: 'saveProfile' } | { type: 'closeProfile' }
export type GameAction = ServerEvent | MyShipsAction | WentHomeAction | HistoryAction | LeaderboardAction | BadgesAction | ProfileAction

/** The pages of `history` received so far, joined into one list. */
export type HistoryView = {
  stats: HistoryStats
  /** Newest first, every page received so far. */
  matches: HistoryMatch[]
  /** The last page received. */
  page: number
  /** An older page exists. */
  more: boolean
  /** The next page has been asked for and hasn't come yet. */
  loadingMore: boolean
}

export type GameState = {
  screen: Screen
  /** Set when `connected` has a protocol version this build can't speak. Everything stops. */
  fatal: string | null
  myId: string | null
  /** From `welcome`, which may differ from what I typed. */
  myName: string | null
  /** My last known score; `lobby` carries none. */
  myScore: number
  lobby: LobbyClient[]
  /** Both players of the current (or last) match, in the server's order. */
  players: PlayerInfo[]
  myShips: Cell[][] | null
  /** Ids that have a `placed` this match. */
  placed: string[]
  turn: Turn | null
  /** Every `fireResult` of this match, oldest first. Both boards derive from it. */
  shots: Shot[]
  winnerId: string | null
  /** Ids that have a `rematchPending`. */
  rematchFrom: string[]
  /** From `matchEnd`, to match the `achievementUnlocked` that may follow it. */
  matchId: string | null
  /** Badges this match earned me, for the end screen. */
  unlocked: BadgeUnlock[]
  /**
   * Set by Home. While true a `matchStart` is ignored (the opponent's rematch
   * can start a new match just as I leave). Cleared by the first `lobby` that
   * lists me as `idle` or `searching`.
   */
  leaving: boolean
  /** `seq` grows on every error, so the same message twice still shows twice. */
  lastError: { code: ErrorCode; message: string; seq: number } | null
  /** A new object per notice, so the same text twice still shows twice. */
  notice: { text: string } | null
  /** Null until the first `history` page after opening the screen. */
  history: HistoryView | null
  /** An `error` came while a history page was loading. */
  historyFailed: boolean
  /** Null until the `leaderboard` reply after opening the screen. Best first. */
  leaderboard: LeaderboardRow[] | null
  /** An `error` came while the leaderboard was loading. */
  leaderboardFailed: boolean
  /** Null until the `achievements` reply after opening the badges screen. */
  achievements: AchievementsView | null
  /** An `error` came while my badges were loading. */
  achievementsFailed: boolean
  /** Null until the `profile` reply after opening the profile; my badges come in `achievements`. */
  profile: ProfileView | null
  /** An `error` came while the profile or my badges were loading. */
  profileFailed: boolean
  /** `profileUpdate` sent; cleared by the `profile` or `error` that answers it. */
  profileSaving: boolean
}

const noMatch = {
  myShips: null,
  placed: [],
  turn: null,
  shots: [],
  winnerId: null,
  rematchFrom: [],
  matchId: null,
  unlocked: [],
} satisfies Partial<GameState>

export const initialState: GameState = {
  screen: 'connecting',
  fatal: null,
  myId: null,
  myName: null,
  myScore: 0,
  lobby: [],
  players: [],
  ...noMatch,
  leaving: false,
  lastError: null,
  notice: null,
  history: null,
  historyFailed: false,
  leaderboard: null,
  leaderboardFailed: false,
  achievements: null,
  achievementsFailed: false,
  profile: null,
  profileFailed: false,
  profileSaving: false,
}

export function gameReducer(state: GameState, event: GameAction): GameState {
  if (state.fatal) return state

  switch (event.type) {
    case 'connected':
      if (event.protocolVersion !== PROTOCOL_VERSION)
        return {
          ...state,
          fatal: `This page speaks protocol v${PROTOCOL_VERSION}, but the server speaks v${event.protocolVersion}.`,
        }
      return { ...state, myId: event.id, screen: 'nickname' }

    case 'welcome':
      return { ...state, myName: event.nickname, screen: 'lobby' }

    case 'lobby': {
      const me = event.clients.find((c) => c.id === state.myId)
      const back = me?.status === 'idle' || me?.status === 'searching'
      return { ...state, lobby: event.clients, leaving: back ? false : state.leaving }
    }

    case 'matchStart':
      if (state.leaving) return state
      return {
        ...state,
        ...noMatch,
        screen: 'placement',
        players: event.players,
        myScore: scoreOf(event.players, state.myId) ?? state.myScore,
        notice: null,
      }

    case 'placed':
      return state.placed.includes(event.id) ? state : { ...state, placed: [...state.placed, event.id] }

    case 'turn':
      return {
        ...state,
        screen: 'game',
        turn: { activePlayerId: event.activePlayerId, seconds: event.seconds, turnNumber: event.turnNumber },
      }

    case 'fireResult':
      return { ...state, shots: [...state.shots, event] }

    case 'matchEnd':
      return {
        ...state,
        screen: 'end',
        matchId: event.matchId,
        players: event.players,
        myScore: scoreOf(event.players, state.myId) ?? state.myScore,
        winnerId: event.winnerId,
      }

    case 'rematchPending':
      return state.rematchFrom.includes(event.from)
        ? state
        : { ...state, rematchFrom: [...state.rematchFrom, event.from] }

    case 'opponentLeft':
      return {
        ...state,
        ...noMatch,
        screen: 'lobby',
        notice: { text: `${nameOf(state, event.id)} left the game` },
      }

    case 'reset':
      return {
        ...state,
        ...noMatch,
        // A client that hasn't joined yet stays on the nickname screen.
        screen: state.myName === null ? state.screen : 'lobby',
        myScore: 0,
        players: state.players.map((p) => ({ ...p, score: 0 })),
        notice: { text: 'The server was reset' },
      }

    // Page 1 starts the list over; the next page adds to it. Anything else
    // (a repeat, or a page that crossed a reopen) is dropped.
    case 'history': {
      const { page, stats, matches, more } = event
      if (page === 1) return { ...state, history: { stats, matches, page, more, loadingMore: false } }
      const shown = state.history
      if (!shown || page !== shown.page + 1) return state
      return { ...state, history: { stats, matches: [...shown.matches, ...matches], page, more, loadingMore: false } }
    }

    case 'leaderboard':
      return { ...state, leaderboard: event.rows }

    case 'achievements': {
      const { wins, bestAccuracy, bestStreak, badges } = event
      return { ...state, achievements: { wins, bestAccuracy, bestStreak, badges } }
    }

    case 'profile': {
      const { guest, avatar, shownBadges, rank, wins } = event
      return { ...state, profile: { guest, avatar, shownBadges, rank, wins }, profileSaving: false }
    }

    // Only for the match on the end screen; one that came late is dropped.
    case 'achievementUnlocked': {
      if (state.screen !== 'end' || event.matchId !== state.matchId) return state
      const fresh = event.badges.filter((b) => !state.unlocked.some((u) => u.code === b.code))
      return fresh.length === 0 ? state : { ...state, unlocked: [...state.unlocked, ...fresh] }
    }

    case 'error': {
      const lastError = { code: event.code, message: event.message, seq: (state.lastError?.seq ?? 0) + 1 }
      // The profile screen sends profileGet and achievementsGet, then only profileUpdate.
      // A refused save keeps the screen and my unsaved choices; the toast says why.
      if (state.screen === 'profile') {
        if (state.profile === null || state.achievements === null) return { ...state, lastError, profileFailed: true }
        return { ...state, lastError, profileSaving: false }
      }
      // The badges screen sends nothing but achievementsGet.
      if (state.screen === 'badges' && state.achievements === null) {
        return { ...state, lastError, achievementsFailed: true }
      }
      // Likewise the leaderboard screen sends nothing but leaderboardGet.
      if (state.screen === 'leaderboard' && state.leaderboard === null) {
        return { ...state, lastError, leaderboardFailed: true }
      }
      // The history screen sends nothing but historyList, so an error there is its answer.
      const loading = state.screen === 'history' && (state.history === null || state.history.loadingMore)
      if (!loading) return { ...state, lastError }
      return {
        ...state,
        lastError,
        historyFailed: true,
        history: state.history && { ...state.history, loadingMore: false },
      }
    }

    // From the lobby, or again from the history screen to retry a failed first
    // page. A lobby notice ("Bob left the game") is done with by now.
    case 'openHistory':
      return state.screen === 'lobby' || state.screen === 'history'
        ? { ...state, screen: 'history', history: null, historyFailed: false, notice: null }
        : state

    case 'loadMoreHistory':
      return state.screen === 'history' && state.history?.more && !state.history.loadingMore
        ? { ...state, historyFailed: false, history: { ...state.history, loadingMore: true } }
        : state

    case 'closeHistory':
      return state.screen === 'history' ? { ...state, screen: 'lobby' } : state

    // From the lobby, or again from the leaderboard to retry a failed load.
    case 'openLeaderboard':
      return state.screen === 'lobby' || state.screen === 'leaderboard'
        ? { ...state, screen: 'leaderboard', leaderboard: null, leaderboardFailed: false, notice: null }
        : state

    case 'closeLeaderboard':
      return state.screen === 'leaderboard' ? { ...state, screen: 'lobby' } : state

    // From the lobby, or again from the badges screen to retry a failed load.
    case 'openBadges':
      return state.screen === 'lobby' || state.screen === 'badges'
        ? { ...state, screen: 'badges', achievements: null, achievementsFailed: false, notice: null }
        : state

    case 'closeBadges':
      return state.screen === 'badges' ? { ...state, screen: 'lobby' } : state

    // From the lobby, or again from the profile to retry a failed load.
    case 'openProfile':
      return state.screen === 'lobby' || state.screen === 'profile'
        ? { ...state, screen: 'profile', profile: null, achievements: null, profileFailed: false, profileSaving: false, notice: null }
        : state

    case 'saveProfile':
      return state.screen === 'profile' && state.profile && !state.profile.guest && !state.profileSaving
        ? { ...state, profileSaving: true }
        : state

    case 'closeProfile':
      return state.screen === 'profile' ? { ...state, screen: 'lobby' } : state

    case 'myShips':
      return { ...state, myShips: event.ships }

    case 'wentHome':
      return state.screen === 'end' ? { ...state, ...noMatch, screen: 'lobby', leaving: true, notice: null } : state

    default:
      assertNever(event)
      return state
  }
}

function scoreOf(players: PlayerInfo[], id: string | null): number | undefined {
  return players.find((p) => p.id === id)?.score
}

function nameOf(state: GameState, id: string): string {
  return (
    state.players.find((p) => p.id === id)?.name ??
    state.lobby.find((c) => c.id === id)?.name ??
    'Your opponent'
  )
}

/** Me and my opponent in `players`, found by id because the order isn't fixed. */
export function matchSides(state: GameState): { me?: PlayerInfo; opponent?: PlayerInfo } {
  return {
    me: state.players.find((p) => p.id === state.myId),
    opponent: state.players.find((p) => p.id !== state.myId),
  }
}

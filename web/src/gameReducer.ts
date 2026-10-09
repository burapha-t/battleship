// The UI's single source of truth: a pure fold over the server's events. The
// server is authoritative, so the only local actions are `myShips` — the ships I
// sent in `place`, which the server never sends back — and `wentHome`.

import { PROTOCOL_VERSION, assertNever } from './protocol'
import type { Cell, ErrorCode, LobbyClient, PlayerInfo, ServerEvent } from './protocol'

export type Screen = 'connecting' | 'login' | 'lobby' | 'placement' | 'game' | 'end'

export type Shot = Extract<ServerEvent, { type: 'fireResult' }>
export type Turn = Omit<Extract<ServerEvent, { type: 'turn' }>, 'type'>

export type MyShipsAction = { type: 'myShips'; ships: Cell[][] }
/** I pressed Home on the end screen. */
export type WentHomeAction = { type: 'wentHome' }
export type GameAction = ServerEvent | MyShipsAction | WentHomeAction

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
}

const noMatch = {
  myShips: null,
  placed: [],
  turn: null,
  shots: [],
  winnerId: null,
  rematchFrom: [],
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
      return { ...state, myId: event.id, screen: 'login' }

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
        // A client that hasn't joined yet stays on the login screen.
        screen: state.myName === null ? state.screen : 'lobby',
        myScore: 0,
        players: state.players.map((p) => ({ ...p, score: 0 })),
        notice: { text: 'The server was reset' },
      }

    case 'error':
      return {
        ...state,
        lastError: { code: event.code, message: event.message, seq: (state.lastError?.seq ?? 0) + 1 },
      }

    case 'myShips':
      return { ...state, myShips: event.ships }

    case 'wentHome':
      return { ...state, ...noMatch, screen: 'lobby', leaving: true }

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

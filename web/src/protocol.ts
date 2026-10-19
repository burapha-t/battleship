// The wire contract: a mirror of docs/implement/protocol.md, which wins if the
// two disagree. Change both in the same PR.

/** On any other `connected.protocolVersion`, show an error and stop (§4). */
export const PROTOCOL_VERSION = 1

/** `[row, col]`, both 0..7; row 0 is the top, col 0 the left (§2). */
export type Cell = [row: number, col: number]

/**
 * A player in `matchStart` and `matchEnd`, which always list 2. The order isn't
 * fixed, so find yourself by `id`.
 */
export type PlayerInfo = { id: string; name: string; score: number }

export type LobbyStatus = 'connecting' | 'idle' | 'searching' | 'placing' | 'in-match'

/** `name` is null until that client's `welcome`. */
export type LobbyClient = { id: string; name: string | null; status: LobbyStatus }

export type ErrorCode =
  | 'bad-nickname'
  | 'bad-credentials'
  | 'username-taken'
  | 'invalid-input'
  | 'already-logged-in'
  | 'invalid-placement'
  | 'not-your-turn'
  | 'already-fired'
  | 'out-of-range'
  | 'not-in-match'
  | 'unknown'

/** The 12 server → client events (§4). */
export type ServerEvent =
  | { type: 'connected'; id: string; protocolVersion: number }
  | { type: 'welcome'; id: string; nickname: string }
  | { type: 'lobby'; count: number; clients: LobbyClient[] }
  | { type: 'matchStart'; matchId: string; players: PlayerInfo[]; firstPlayerId: string }
  | { type: 'placed'; id: string }
  | { type: 'turn'; activePlayerId: string; seconds: number; turnNumber: number }
  | {
      type: 'fireResult'
      by: string
      target: string
      row: number
      col: number
      result: 'hit' | 'miss'
      sunk: boolean
      sunkCells: Cell[] | null
      allSunk: boolean
      auto: boolean
    }
  | { type: 'matchEnd'; matchId: string; winnerId: string; players: PlayerInfo[] }
  | { type: 'rematchPending'; from: string }
  | { type: 'opponentLeft'; id: string }
  | { type: 'reset' }
  | { type: 'error'; code: ErrorCode; message: string }

/**
 * The 5 client → server verbs (§5), plus `login`, `signup` and `leave`, which
 * are specified in /backend_requirements.md and not yet in protocol.md.
 */
export type ClientVerb =
  | { type: 'join'; nickname: string }
  // `signup` also logs in; the server answers both with `welcome`.
  | { type: 'login'; username: string; password: string }
  | { type: 'signup'; username: string; password: string }
  // Leave a finished match; the opponent gets `opponentLeft`.
  | { type: 'leave' }
  | { type: 'findMatch' }
  | { type: 'place'; ships: Cell[][] }
  | { type: 'fire'; row: number; col: number }
  | { type: 'rematch' }

/**
 * Call in the `default` of a `switch (event.type)`. If a case is missing,
 * `event` isn't `never` there, so the build fails.
 *
 *     default:
 *       assertNever(event)
 *       return state
 *
 * It doesn't throw: a newer server may send a `type` this build doesn't know,
 * and §1 rule 1 says to ignore it.
 */
export function assertNever(_value: never): void {}

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
  | 'invalid-placement'
  | 'not-your-turn'
  | 'already-fired'
  | 'out-of-range'
  | 'not-in-match'
  | 'invalid-profile'
  | 'not-logged-in'
  | 'invalid-input'
  | 'username-taken'
  | 'bad-credentials'
  | 'already-logged-in'
  | 'unknown'

/** Totals over all my saved matches. Rates are percentages with one decimal; 0 with no matches. */
export type HistoryStats = { matchCount: number; winCount: number; loseCount: number; winRate: number; accuracy: number }

/** One saved match from my side. `endedAt` is UTC ISO 8601; show it in local time. */
export type HistoryMatch = { won: boolean; opponent: string; endedAt: string; accuracy: number }

/**
 * One ranked account. `points` = wins; `accuracy` = hits ÷ shots as a percentage
 * with one decimal, 0 with no shots. Ties on both share a `rank` (1, 1, 3).
 */
export type LeaderboardRow = { rank: number; name: string; points: number; accuracy: number }

/** One badge I own (#41): `code` from the catalogue in badges.ts, `unlockedAt` UTC ISO 8601. */
export type BadgeUnlock = { code: string; unlockedAt: string }

/**
 * My badges and the stats they're earned from (#41): total wins, best
 * single-match accuracy (a percentage with one decimal) and best hit streak.
 * `badges` is oldest first.
 */
export type AchievementsView = { wins: number; bestAccuracy: number; bestStreak: number; badges: BadgeUnlock[] }

/**
 * My profile (#42). `guest`: not logged in, so I can't save. `avatar` is ''
 * for none or a code from screens/profileText.ts; `shownBadges` 0–3 codes in
 * my order; `rank` my leaderboard place, null with no saved match.
 */
export type ProfileView = { guest: boolean; avatar: string; shownBadges: string[]; rank: number | null; wins: number }

/** The 17 server → client events (§4). */
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
  // My match history, one page of 20, newest first; `more` = an older page exists.
  | { type: 'history'; page: number; stats: HistoryStats; matches: HistoryMatch[]; more: boolean }
  // The all-time leaderboard, at most 50 rows, best first.
  | { type: 'leaderboard'; rows: LeaderboardRow[] }
  // My badges and best stats; a guest gets zeros and none.
  | ({ type: 'achievements' } & AchievementsView)
  // Badges the match `matchId` just earned me, sent after its `matchEnd`.
  | { type: 'achievementUnlocked'; matchId: string; badges: BadgeUnlock[] }
  // My profile; the reply to `profileGet` and to a saved `profileUpdate`.
  | ({ type: 'profile' } & ProfileView)
  | { type: 'error'; code: ErrorCode; message: string }

/** The 13 client → server verbs (§5). */
export type ClientVerb =
  | { type: 'join'; nickname: string }
  // Create an account and log in to it; the reply is `welcome` or `error`.
  | { type: 'signup'; username: string; password: string }
  // Log in to an existing account; the reply is `welcome` or `error`.
  | { type: 'login'; username: string; password: string }
  | { type: 'findMatch' }
  | { type: 'place'; ships: Cell[][] }
  | { type: 'fire'; row: number; col: number }
  | { type: 'rematch' }
  // Leave a finished match; the opponent gets `opponentLeft`.
  | { type: 'leave' }
  // One page of my match history, 1 = newest; the reply is `history`.
  | { type: 'historyList'; page: number }
  // The leaderboard; the reply is `leaderboard`.
  | { type: 'leaderboardGet' }
  // My badges; the reply is `achievements`.
  | { type: 'achievementsGet' }
  // My profile; the reply is `profile`.
  | { type: 'profileGet' }
  // Save my picture ('' for none) and up to 3 earned badges; the reply is `profile` or `error`.
  | { type: 'profileUpdate'; avatar: string; shownBadges: string[] }

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

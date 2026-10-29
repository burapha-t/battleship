import { describe, expect, it, vi } from 'vitest'
import { canQuitGhostMatch, gameReducer, initialState, matchSides } from './gameReducer'
import type { GameAction, GameState } from './gameReducer'
import type { HistoryMatch, ServerEvent } from '../protocol'
import { replayActions } from './replay'
import { parseServerEvent } from './useGameSocket'

const fold = (actions: GameAction[], from: GameState = initialState) => actions.reduce(gameReducer, from)

describe('Ghost Fleet quit visibility', () => {
  it('is limited to placement and active gameplay in a tracked bot match', () => {
    expect(canQuitGhostMatch({ gameMode: 'bot', screen: 'placement' })).toBe(true)
    expect(canQuitGhostMatch({ gameMode: 'bot', screen: 'game' })).toBe(true)
    expect(canQuitGhostMatch({ gameMode: 'bot', screen: 'lobby' })).toBe(false)
    expect(canQuitGhostMatch({ gameMode: 'bot', screen: 'end' })).toBe(false)
    expect(canQuitGhostMatch({ gameMode: 'player', screen: 'game' })).toBe(false)
    expect(canQuitGhostMatch({ gameMode: null, screen: 'placement' })).toBe(false)
  })
})

describe("replaying p1's side of the golden transcript", () => {
  const actions = replayActions('p1')
  const firstEnd = actions.findIndex((a) => a.type === 'matchEnd') + 1

  it('reaches the end screen as Win, 1–0', () => {
    const state = fold(actions.slice(0, firstEnd))
    const { me, opponent } = matchSides(state)
    expect(state.screen).toBe('end')
    expect(state.winnerId).toBe(state.myId)
    expect(me).toMatchObject({ id: 'p1', name: 'Alice', score: 1 })
    expect(opponent).toMatchObject({ id: 'p2', name: 'Bob', score: 0 })
    expect(state.myScore).toBe(1)
  })

  it('draws both boards from fireResult only', () => {
    const state = fold(actions.slice(0, firstEnd))
    const mine = state.shots.filter((s) => s.by === 'p1')
    expect(mine.filter((s) => s.sunk)).toHaveLength(4)
    expect(state.myShips).toHaveLength(4)
  })

  it('ends in the lobby with both scores 0 after reset and opponentLeft', () => {
    const state = fold(actions)
    expect(state.screen).toBe('lobby')
    expect(state.myScore).toBe(0)
    expect(state.players.map((p) => p.score)).toEqual([0, 0])
    expect(state.notice?.text).toBe('Bob left the game')
    expect(state.myShips).toBeNull()
    expect(state.shots).toEqual([])
  })

  it('goes through every screen in order', () => {
    const screens: string[] = []
    actions.reduce((state, action) => {
      const next = gameReducer(state, action)
      if (next.screen !== screens.at(-1)) screens.push(next.screen)
      return next
    }, initialState)
    expect(screens).toEqual([
      'nickname', 'lobby', 'placement', 'game', 'end', // m1
      'placement', 'game', // rematch m2
      'lobby', // reset
      'placement', 'lobby', // m3, then Bob leaves
    ])
  })
})

describe('gameReducer', () => {
  const joined = fold([
    { type: 'connected', id: 'p1', protocolVersion: 1 },
    { type: 'welcome', id: 'p1', nickname: 'Alice (2)' },
  ])

  it('uses the nickname from welcome', () => {
    expect(joined.myName).toBe('Alice (2)')
    expect(joined.screen).toBe('lobby')
  })

  it('tracks bot mode from the relay rather than an opponent nickname', () => {
    const bot = fold([
      { type: 'ghostMode', active: true },
      { type: 'matchStart', matchId: 'm1', players: [
        { id: 'p1', name: 'Alice', score: 0 },
        { id: 'p2', name: 'Not named Ghost Fleet', score: 0 },
      ], firstPlayerId: 'p1' },
    ], joined)
    expect(bot.gameMode).toBe('bot')
    expect(gameReducer(bot, { type: 'opponentLeft', id: 'p2' }).gameMode).toBeNull()

    const human = gameReducer(joined, { type: 'matchStart', matchId: 'm2', players: [], firstPlayerId: 'p1' })
    expect(human.gameMode).toBe('player')
  })

  it('stops on an unsupported protocol version', () => {
    const state = fold([
      { type: 'connected', id: 'p1', protocolVersion: 2 },
      { type: 'welcome', id: 'p1', nickname: 'Alice' },
    ])
    expect(state.fatal).toMatch(/v2/)
    expect(state.screen).toBe('connecting')
  })

  it('error only sets lastError', () => {
    const state = gameReducer(joined, { type: 'error', code: 'not-in-match', message: 'Nope.' })
    expect(state).toEqual({ ...joined, lastError: { code: 'not-in-match', message: 'Nope.', seq: 1 } })
    expect(gameReducer(state, { type: 'error', code: 'unknown', message: 'Nope.' }).lastError?.seq).toBe(2)
  })

  it('ignores an unknown type', () => {
    const unknown = { type: 'chat', text: 'hi' } as unknown as ServerEvent
    expect(gameReducer(joined, unknown)).toBe(joined)
  })

  it('a reset before joining stays on the nickname screen', () => {
    const state = fold([{ type: 'connected', id: 'p1', protocolVersion: 1 }, { type: 'reset' }])
    expect(state.screen).toBe('nickname')
  })

  it('a rematch clears both boards and my ships', () => {
    const players = [
      { id: 'p2', name: 'Bob', score: 0 },
      { id: 'p1', name: 'Alice', score: 3 },
    ]
    const state = fold(
      [
        { type: 'matchStart', matchId: 'm1', players, firstPlayerId: 'p1' },
        { type: 'myShips', ships: [[[0, 0], [0, 1], [0, 2], [0, 3]]] },
        { type: 'placed', id: 'p1' },
        { type: 'turn', activePlayerId: 'p1', seconds: 10, turnNumber: 1 },
        { type: 'fireResult', by: 'p1', target: 'p2', row: 1, col: 1, result: 'miss', sunk: false, sunkCells: null, allSunk: false, auto: false },
        { type: 'rematchPending', from: 'p2' },
        { type: 'matchStart', matchId: 'm2', players, firstPlayerId: 'p1' },
      ],
      joined,
    )
    expect(state.screen).toBe('placement')
    expect(state.myScore).toBe(3)
    expect(state).toMatchObject({ myShips: null, placed: [], turn: null, shots: [], rematchFrom: [] })
  })

  describe('Home', () => {
    const players = [
      { id: 'p1', name: 'Alice', score: 2 },
      { id: 'p2', name: 'Bob', score: 1 },
    ]
    const ended = fold(
      [
        { type: 'matchStart', matchId: 'm1', players, firstPlayerId: 'p1' },
        { type: 'myShips', ships: [[[0, 0], [0, 1], [0, 2], [0, 3]]] },
        { type: 'turn', activePlayerId: 'p1', seconds: 10, turnNumber: 1 },
        { type: 'fireResult', by: 'p1', target: 'p2', row: 1, col: 1, result: 'hit', sunk: false, sunkCells: null, allSunk: false, auto: false },
        { type: 'matchEnd', matchId: 'm1', winnerId: 'p1', players },
        { type: 'rematchPending', from: 'p2' },
      ],
      joined,
    )

    it('wentHome takes me to the lobby, keeps my score and clears the match', () => {
      const state = gameReducer(ended, { type: 'wentHome' })
      expect(state.screen).toBe('lobby')
      expect(state.myScore).toBe(2)
      expect(state.leaving).toBe(true)
      expect(state).toMatchObject({ myShips: null, shots: [], turn: null, winnerId: null, rematchFrom: [], notice: null })
    })

    it('wentHome does nothing off the end screen', () => {
      const playing = fold([{ type: 'matchStart', matchId: 'm1', players, firstPlayerId: 'p1' }], joined)
      expect(gameReducer(playing, { type: 'wentHome' })).toBe(playing)
    })

    it("ignores a rematch's matchStart that crossed my leave, until a lobby lists me idle", () => {
      const home = gameReducer(ended, { type: 'wentHome' })
      const crossed = gameReducer(home, { type: 'matchStart', matchId: 'm2', players, firstPlayerId: 'p1' })
      expect(crossed).toBe(home)

      const placing = gameReducer(crossed, {
        type: 'lobby',
        count: 2,
        clients: [
          { id: 'p1', name: 'Alice', status: 'placing' },
          { id: 'p2', name: 'Bob', status: 'placing' },
        ],
      })
      expect(placing.leaving).toBe(true)

      const idle = gameReducer(placing, {
        type: 'lobby',
        count: 2,
        clients: [
          { id: 'p1', name: 'Alice', status: 'idle' },
          { id: 'p2', name: 'Bob', status: 'idle' },
        ],
      })
      expect(idle.leaving).toBe(false)
      expect(gameReducer(idle, { type: 'matchStart', matchId: 'm3', players, firstPlayerId: 'p2' }).screen).toBe('placement')
    })

    it('the other player goes to the lobby on opponentLeft, with a notice', () => {
      const state = gameReducer(ended, { type: 'opponentLeft', id: 'p2' })
      expect(state.screen).toBe('lobby')
      expect(state.myScore).toBe(2)
      expect(state.notice?.text).toBe('Bob left the game')
    })
  })
})

describe('parseServerEvent', () => {
  it('skips malformed JSON and unknown types, keeps unknown fields', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(parseServerEvent('{"type":"reset"')).toBeNull()
    expect(parseServerEvent('{"type":"chat"}')).toBeNull()
    expect(parseServerEvent('null')).toBeNull()
    expect(parseServerEvent('{"type":"reset","extra":1}')).toEqual({ type: 'reset', extra: 1 })
    expect(parseServerEvent('{"type":"ghostMode","active":true}')).toEqual({ type: 'ghostMode', active: true })
    expect(warn).toHaveBeenCalledTimes(3)
    warn.mockRestore()
  })
})

describe('match history', () => {
  const lobby = fold([
    { type: 'connected', id: 'p1', protocolVersion: 1 },
    { type: 'welcome', id: 'p1', nickname: 'Alice' },
  ])
  const stats = { matchCount: 21, winCount: 13, loseCount: 8, winRate: 61.9, accuracy: 48.2 }
  const match = (n: number): HistoryMatch => ({
    won: n % 2 === 0,
    opponent: `Captain ${n}`,
    endedAt: `2026-10-19T07:${String(59 - n).padStart(2, '0')}:00Z`,
    accuracy: 50,
  })
  const page1: ServerEvent = { type: 'history', page: 1, stats, matches: Array.from({ length: 20 }, (_, i) => match(i)), more: true }
  const page2: ServerEvent = { type: 'history', page: 2, stats, matches: [match(20)], more: false }
  const open = gameReducer(lobby, { type: 'openHistory' })

  it('opens from the lobby and waits for the first page', () => {
    expect(open.screen).toBe('history')
    expect(open.history).toBeNull()
  })

  it('opening it clears an old lobby notice', () => {
    const left = { ...lobby, notice: { text: 'Bob left the game' } }
    expect(gameReducer(left, { type: 'openHistory' }).notice).toBeNull()
  })

  it('a history message fills the screen', () => {
    const state = gameReducer(open, page1)
    expect(state.history?.stats).toEqual(stats)
    expect(state.history?.matches).toHaveLength(20)
    expect(state.history?.more).toBe(true)
  })

  it('the next page adds to the list', () => {
    const asked = gameReducer(gameReducer(open, page1), { type: 'loadMoreHistory' })
    expect(asked.history?.loadingMore).toBe(true)
    const state = gameReducer(asked, page2)
    expect(state.history?.matches.map((m) => m.opponent)).toEqual(Array.from({ length: 21 }, (_, i) => `Captain ${i}`))
    expect(state.history?.page).toBe(2)
    expect(state.history?.more).toBe(false)
    expect(state.history?.loadingMore).toBe(false)
  })

  it('drops a repeated page instead of listing it twice', () => {
    const twice = [page2, page2].reduce(gameReducer, gameReducer(open, page1))
    expect(twice.history?.matches).toHaveLength(21)
  })

  it('a new player sees an empty list, not an error', () => {
    const empty: ServerEvent = {
      type: 'history',
      page: 1,
      stats: { matchCount: 0, winCount: 0, loseCount: 0, winRate: 0, accuracy: 0 },
      matches: [],
      more: false,
    }
    const state = gameReducer(open, empty)
    expect(state.history?.matches).toEqual([])
    expect(state.historyFailed).toBe(false)
    expect(state.lastError).toBeNull()
  })

  it('an error while loading marks the load failed, and reopening clears it', () => {
    const failed = gameReducer(open, { type: 'error', code: 'unknown', message: 'x' })
    expect(failed.historyFailed).toBe(true)
    expect(gameReducer(failed, { type: 'openHistory' }).historyFailed).toBe(false)
  })

  it('back goes to the lobby; history only opens from the lobby', () => {
    expect(gameReducer(open, { type: 'closeHistory' }).screen).toBe('lobby')
    const placing = gameReducer(lobby, { type: 'matchStart', matchId: 'm1', players: [], firstPlayerId: 'p1' })
    expect(gameReducer(placing, { type: 'openHistory' }).screen).toBe('placement')
  })
})

describe('leaderboard', () => {
  const lobby = fold([
    { type: 'connected', id: 'p1', protocolVersion: 1 },
    { type: 'welcome', id: 'p1', nickname: 'Alice' },
  ])
  const rows = [
    { rank: 1, name: 'Mira', points: 11, accuracy: 62.5 },
    { rank: 1, name: 'Bob', points: 11, accuracy: 62.5 },
    { rank: 3, name: 'Alice', points: 8, accuracy: 48.7 },
  ]
  const open = gameReducer(lobby, { type: 'openLeaderboard' })

  it('opens from the lobby and waits for the reply', () => {
    expect(open.screen).toBe('leaderboard')
    expect(open.leaderboard).toBeNull()
  })

  it('a leaderboard message fills the table', () => {
    const state = gameReducer(open, { type: 'leaderboard', rows })
    expect(state.leaderboard).toEqual(rows)
    expect(state.leaderboardFailed).toBe(false)
  })

  it('no ranked players is an empty table, not an error', () => {
    const state = gameReducer(open, { type: 'leaderboard', rows: [] })
    expect(state.leaderboard).toEqual([])
    expect(state.leaderboardFailed).toBe(false)
  })

  it('an error while loading marks the load failed, and reopening clears it', () => {
    const failed = gameReducer(open, { type: 'error', code: 'unknown', message: 'x' })
    expect(failed.leaderboardFailed).toBe(true)
    const retried = gameReducer(failed, { type: 'openLeaderboard' })
    expect(retried.leaderboardFailed).toBe(false)
    expect(retried.screen).toBe('leaderboard')
  })

  it('Home goes to the lobby; the leaderboard only opens from the lobby', () => {
    expect(gameReducer(open, { type: 'closeLeaderboard' }).screen).toBe('lobby')
    const placing = gameReducer(lobby, { type: 'matchStart', matchId: 'm1', players: [], firstPlayerId: 'p1' })
    expect(gameReducer(placing, { type: 'openLeaderboard' }).screen).toBe('placement')
  })
})

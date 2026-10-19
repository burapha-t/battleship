import { describe, expect, it, vi } from 'vitest'
import { gameReducer, initialState, matchSides } from './gameReducer'
import type { GameAction, GameState } from './gameReducer'
import type { ServerEvent } from './protocol'
import { replayActions } from './replay'
import { parseServerEvent } from './useGameSocket'

const fold = (actions: GameAction[], from: GameState = initialState) => actions.reduce(gameReducer, from)

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

  describe('streakUpdate', () => {
    const players = [
      { id: 'p1', name: 'Alice', score: 0 },
      { id: 'p2', name: 'Bob', score: 0 },
    ]
    const playing = fold(
      [
        { type: 'matchStart', matchId: 'm1', players, firstPlayerId: 'p1' },
        { type: 'turn', activePlayerId: 'p1', seconds: 10, turnNumber: 1 },
      ],
      joined,
    )

    it("stores the server's count as is, for either player", () => {
      const mine = gameReducer(playing, { type: 'streakUpdate', player: 'p1', count: 5 })
      expect(mine.streak).toEqual({ player: 'p1', count: 5 })
      const theirs = gameReducer(mine, { type: 'streakUpdate', player: 'p2', count: 2 })
      expect(theirs.streak).toEqual({ player: 'p2', count: 2 })
    })

    it('makes a new object per event, so the same count twice shows twice', () => {
      const first = gameReducer(playing, { type: 'streakUpdate', player: 'p1', count: 2 })
      const again = gameReducer(first, { type: 'streakUpdate', player: 'p1', count: 2 })
      expect(again.streak).not.toBe(first.streak)
    })

    it('a shot alone never changes it: the client does not count', () => {
      const state = fold(
        [
          { type: 'fireResult', by: 'p1', target: 'p2', row: 0, col: 0, result: 'hit', sunk: false, sunkCells: null, allSunk: false, auto: false },
          { type: 'fireResult', by: 'p1', target: 'p2', row: 0, col: 1, result: 'hit', sunk: false, sunkCells: null, allSunk: false, auto: false },
        ],
        playing,
      )
      expect(state.streak).toBeNull()
    })

    it("the same player's next shot hides the old count, so a miss doesn't leave it up", () => {
      const hot = gameReducer(playing, { type: 'streakUpdate', player: 'p1', count: 5 })
      const theirShot = gameReducer(hot, { type: 'fireResult', by: 'p2', target: 'p1', row: 0, col: 0, result: 'miss', sunk: false, sunkCells: null, allSunk: false, auto: false })
      expect(theirShot.streak).toBe(hot.streak)
      const myMiss = gameReducer(theirShot, { type: 'fireResult', by: 'p1', target: 'p2', row: 7, col: 7, result: 'miss', sunk: false, sunkCells: null, allSunk: false, auto: false })
      expect(myMiss.streak).toBeNull()
    })

    it.each<[string, GameAction]>([
      ['a new match', { type: 'matchStart', matchId: 'm2', players, firstPlayerId: 'p1' }],
      ['reset', { type: 'reset' }],
      ['opponentLeft', { type: 'opponentLeft', id: 'p2' }],
    ])('is cleared by %s', (_, action) => {
      const hot = gameReducer(playing, { type: 'streakUpdate', player: 'p1', count: 3 })
      expect(gameReducer(hot, action).streak).toBeNull()
    })

    it("follows the golden transcript's counts", () => {
      const counts = replayActions('p2').flatMap((a) => (a.type === 'streakUpdate' && a.player === 'p1' ? [a.count] : []))
      expect(counts).toEqual([2, 3, 4, 2, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    })
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
    expect(parseServerEvent('{"type":"streakUpdate","player":"p1","count":2}')).toEqual({
      type: 'streakUpdate',
      player: 'p1',
      count: 2,
    })
    expect(warn).toHaveBeenCalledTimes(3)
    warn.mockRestore()
  })
})

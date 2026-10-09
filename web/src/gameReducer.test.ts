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
})

describe('parseServerEvent', () => {
  it('skips malformed JSON and unknown types, keeps unknown fields', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(parseServerEvent('{"type":"reset"')).toBeNull()
    expect(parseServerEvent('{"type":"chat"}')).toBeNull()
    expect(parseServerEvent('null')).toBeNull()
    expect(parseServerEvent('{"type":"reset","extra":1}')).toEqual({ type: 'reset', extra: 1 })
    expect(warn).toHaveBeenCalledTimes(3)
    warn.mockRestore()
  })
})

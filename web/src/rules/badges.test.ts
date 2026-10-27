import { describe, expect, it } from 'vitest'
import { BADGES, GROUPS, groupProgress } from './badges'
import { gameReducer, initialState } from '../state/gameReducer'
import type { GameState } from '../state/gameReducer'
import type { AchievementsView, BadgeUnlock, ServerEvent } from '../protocol'
import { badgeLabel, nextText, statText } from '../i18n/badgesText'
import { parseServerEvent } from '../state/useGameSocket'

const lobby: GameState = { ...initialState, screen: 'lobby', myId: 'p1', myName: 'Alice' }
const at = '2026-10-19T07:00:00Z'
const owned = (...codes: string[]): BadgeUnlock[] => codes.map((code) => ({ code, unlockedAt: at }))

describe('badges screen (#41)', () => {
  const achievements: ServerEvent = {
    type: 'achievements',
    wins: 12,
    bestAccuracy: 64.3,
    bestStreak: 7,
    badges: owned('wins-5', 'wins-10', 'accuracy-40', 'accuracy-50', 'accuracy-60', 'streak-4', 'streak-6'),
  }
  const open = gameReducer(lobby, { type: 'openBadges' })

  it('opens from the lobby with nothing loaded', () => {
    expect(open.screen).toBe('badges')
    expect(open.achievements).toBeNull()
    expect(gameReducer({ ...lobby, screen: 'game' }, { type: 'openBadges' }).screen).toBe('game')
  })

  it('an achievements message fills the groups', () => {
    const state = gameReducer(open, achievements)
    const view = state.achievements!
    expect(GROUPS.map((group) => groupProgress(group, view))).toEqual([
      { group: 'wins', value: 12, earned: 2, next: expect.objectContaining({ code: 'wins-20' }), fraction: 12 / 20 },
      { group: 'accuracy', value: 64.3, earned: 3, next: expect.objectContaining({ code: 'accuracy-70' }), fraction: 64.3 / 70 },
      { group: 'streak', value: 7, earned: 2, next: expect.objectContaining({ code: 'streak-8' }), fraction: 7 / 8 },
    ])
  })

  it('an error while loading is the answer; opening again retries', () => {
    const failed = gameReducer(open, { type: 'error', code: 'unknown', message: 'nope' })
    expect(failed.achievementsFailed).toBe(true)
    const retried = gameReducer(failed, { type: 'openBadges' })
    expect(retried).toMatchObject({ screen: 'badges', achievements: null, achievementsFailed: false })
  })

  it('goes back to the lobby', () => {
    expect(gameReducer(gameReducer(open, achievements), { type: 'closeBadges' }).screen).toBe('lobby')
  })

  it('the socket accepts both badge events', () => {
    expect(parseServerEvent(JSON.stringify(achievements))).toEqual(achievements)
    expect(parseServerEvent('{"type":"achievementUnlocked","matchId":"m1","badges":[]}')?.type).toBe('achievementUnlocked')
  })
})

describe('progress toward the next badge', () => {
  const view = (patch: Partial<AchievementsView>): AchievementsView => ({ wins: 0, bestAccuracy: 0, bestStreak: 0, badges: [], ...patch })

  it('a new player is working toward the first tier', () => {
    const wins = groupProgress('wins', view({ wins: 3 }))
    expect(wins).toMatchObject({ earned: 0, fraction: 3 / 5 })
    expect(nextText(wins, 'en')).toBe('Next: 5 wins')
    expect(statText(wins, 'en')).toBe('3 wins')
  })

  it('owning all five leaves nothing next and a full bar', () => {
    const streak = groupProgress('streak', view({ bestStreak: 16, badges: owned('streak-4', 'streak-6', 'streak-8', 'streak-10', 'streak-12') }))
    expect(streak).toMatchObject({ earned: 5, next: null, fraction: 1 })
    expect(nextText(streak, 'en')).toBe('All five earned!')
  })

  it('the next badge is the lowest one not owned, and the bar never overflows', () => {
    const accuracy = groupProgress('accuracy', view({ bestAccuracy: 90, badges: owned('accuracy-40', 'accuracy-60') }))
    expect(accuracy.next?.code).toBe('accuracy-50')
    expect(accuracy.fraction).toBe(1)
  })

  it('speaks Thai', () => {
    const accuracy = groupProgress('accuracy', view({ bestAccuracy: 64.3, badges: owned('accuracy-40') }))
    expect(statText(accuracy, 'th')).toBe('ดีที่สุด 64.3%')
    expect(nextText(accuracy, 'th')).toBe('ถัดไป: มากกว่า 50%')
    expect(badgeLabel('wins-20', 'th')).toBe('ชนะ 20 ครั้ง')
    expect(badgeLabel('streak-6', 'en')).toBe('6 in a row')
  })
})

describe('unlock card on the end screen', () => {
  const ended: GameState = { ...lobby, screen: 'end', matchId: 'm1' }
  const event: ServerEvent = { type: 'achievementUnlocked', matchId: 'm1', badges: owned('wins-5', 'streak-4') }

  it('matchEnd remembers the match id', () => {
    const state = gameReducer(lobby, { type: 'matchEnd', matchId: 'm7', winnerId: 'p1', players: [] })
    expect(state.matchId).toBe('m7')
  })

  it('keeps the badges for this match, once each', () => {
    const unlocked = gameReducer(ended, event)
    expect(unlocked.unlocked.map((b) => b.code)).toEqual(['wins-5', 'streak-4'])
    expect(gameReducer(unlocked, event)).toBe(unlocked)
  })

  it('drops badges for another match, or once off the end screen', () => {
    expect(gameReducer(ended, { ...event, matchId: 'm0' })).toBe(ended)
    expect(gameReducer({ ...ended, screen: 'lobby' }, event).unlocked).toEqual([])
  })

  it('clears them on the next match, Home and RESET', () => {
    const unlocked = gameReducer(ended, event)
    expect(gameReducer(unlocked, { type: 'matchStart', matchId: 'm2', players: [], firstPlayerId: 'p1' }).unlocked).toEqual([])
    expect(gameReducer(unlocked, { type: 'wentHome' }).unlocked).toEqual([])
    expect(gameReducer(unlocked, { type: 'reset' }).unlocked).toEqual([])
  })
})

it('the catalogue has the 15 codes in tier order', () => {
  expect(BADGES.map((b) => b.code)).toEqual([
    'wins-5', 'wins-10', 'wins-20', 'wins-50', 'wins-100',
    'accuracy-40', 'accuracy-50', 'accuracy-60', 'accuracy-70', 'accuracy-80',
    'streak-4', 'streak-6', 'streak-8', 'streak-10', 'streak-12',
  ])
})

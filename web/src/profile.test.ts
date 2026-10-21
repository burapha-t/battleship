// Profile (#42) and achievement (#41) state, catalogue and draft rules.
import { expect, it } from 'vitest'
import { BADGES, editableProfile, profileDirty, toggleBadge } from './badges'
import { gameReducer, initialState } from './gameReducer'
import type { GameState } from './gameReducer'
import type { ProfileView } from './protocol'
const profile: ProfileView = { avatar: 'crab', shownBadges: [], wins: 8, bestAccuracy: 73, bestStreak: 6, badges: [{ code: 'wins-5', unlockedAt: '2026-10-21T07:00:00Z' }] }
const lobby: GameState = { ...initialState, screen: 'lobby', myName: 'Alice' }
it('opens, receives, and closes the profile; invalid updates retain saved data and draft key', () => {
  const opened = gameReducer(lobby, { type: 'openProfile' })
  expect(opened).toMatchObject({ screen: 'profile', profile: null, profileFailed: false })
  const loaded = gameReducer(opened, { type: 'profile', ...profile })
  const saving = gameReducer(loaded, { type: 'saveProfile' })
  const failed = gameReducer(saving, { type: 'error', code: 'invalid-profile', message: 'Unowned badge' })
  expect(failed.profile).toBe(loaded.profile)
  expect(failed.profileSaving).toBe(false)
  expect(failed.profileFailed).toBe(false)
  expect(gameReducer(failed, { type: 'closeProfile' }).screen).toBe('lobby')
})
it('records load failures and permits retry', () => {
  let state = gameReducer(lobby, { type: 'openProfile' })
  state = gameReducer(state, { type: 'error', code: 'unknown', message: 'Unavailable' })
  expect(state.profileFailed).toBe(true)
  expect(gameReducer(state, { type: 'openProfile' }).profileFailed).toBe(false)
})
it('stores unlocks through the result delay and clears them on next match, home and reset', () => {
  const ended: GameState = { ...lobby, screen: 'end', matchId: 'm1' }
  const event = { type: 'achievementUnlocked' as const, matchId: 'm1', badges: profile.badges }
  const unlocked = gameReducer(ended, event)
  expect(unlocked.unlocked).toEqual(profile.badges)
  expect(gameReducer(unlocked, event).unlocked).toHaveLength(1)
  expect(gameReducer(unlocked, { ...event, matchId: 'old' })).toBe(unlocked)
  expect(gameReducer(unlocked, { type: 'matchStart', matchId: 'm2', players: [], firstPlayerId: 'p1' }).unlocked).toEqual([])
  expect(gameReducer(unlocked, { type: 'wentHome' }).unlocked).toEqual([])
  expect(gameReducer(unlocked, { type: 'reset' }).unlocked).toEqual([])
  expect(gameReducer(lobby, event)).toBe(lobby)
})
it('has exactly 15 unique codes in tier order and the specified colours', () => {
  expect(BADGES.map(b => b.code)).toEqual(['wins-5','wins-10','wins-20','wins-50','wins-100','accuracy-40','accuracy-50','accuracy-60','accuracy-70','accuracy-80','streak-4','streak-6','streak-8','streak-10','streak-12'])
  expect(new Set(BADGES.map(b => b.code)).size).toBe(15)
  expect(BADGES.map(b => b.colour)).toEqual(['#FFF1C2','#FFE08A','#FFC83D','#F2A81D','#D98A0B','#CFE8FB','#9CCDF3','#5AAEEB','#2F8FE0','#1E6FBF','#FFD3CF','#FFA9A3','#FF7A70','#FF4F5E','#D9283A'])
  expect(BADGES.map(b => b.white)).toEqual([false,false,false,false,true,false,false,false,true,true,false,false,false,true,true])
})
it('only toggles earned valid badges, caps at three and never duplicates', () => {
  const earned = BADGES.map(b => b.code)
  expect(toggleBadge([], 'wins-5', [])).toEqual([])
  expect(toggleBadge([], 'invented', ['invented'])).toEqual([])
  expect(toggleBadge(['wins-5'], 'wins-5', earned)).toEqual([])
  const three = ['wins-5','wins-10','wins-20']
  expect(toggleBadge(three, 'wins-50', earned)).toBe(three)
  expect(toggleBadge(three.slice(0, 2), 'wins-20', earned)).toEqual(three)
})
it('detects dirty choices, including order, and distinguishes non-default profiles temporarily', () => {
  expect(profileDirty(profile, 'crab', [])).toBe(false)
  expect(profileDirty(profile, 'whale', [])).toBe(true)
  expect(profileDirty(profile, 'crab', ['wins-5'])).toBe(true)
  expect(profileDirty({ ...profile, shownBadges: ['wins-5','streak-4'] }, 'crab', ['streak-4','wins-5'])).toBe(true)
  expect(editableProfile(profile)).toBe(true)
  expect(editableProfile({ avatar: '', shownBadges: [], wins: 0, bestAccuracy: 0, bestStreak: 0, badges: [] })).toBe(false)
})

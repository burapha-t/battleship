import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { gameReducer, initialState } from './gameReducer'
import type { GameState } from './gameReducer'
import { MAX_SHOWN, profileDirty, toggleBadge } from './profile'
import type { AchievementsView, ProfileView, ServerEvent } from './protocol'
import { ProfileScreen } from './screens/ProfileScreen'
import { bestText, chosenText, rankLine } from './screens/profileText'
import { parseServerEvent } from './useGameSocket'

// The settings store has no server snapshot, so markup renders in English here.
vi.mock('./useSettings', () => ({ useSettings: () => ({ language: 'en', musicVolume: 50, effectsVolume: 50 }) }))

const lobby: GameState = { ...initialState, screen: 'lobby', myId: 'p1', myName: 'Alice' }
const at = '2026-10-19T07:00:00Z'
const saved: ProfileView = { guest: false, avatar: 'pufferfish', shownBadges: ['wins-5', 'accuracy-70', 'streak-6'], rank: 3, wins: 8 }
const profile: ServerEvent = { type: 'profile', ...saved }
const achievements: ServerEvent = {
  type: 'achievements',
  wins: 8,
  bestAccuracy: 73,
  bestStreak: 6,
  badges: ['wins-5', 'accuracy-40', 'accuracy-50', 'accuracy-60', 'accuracy-70', 'streak-4', 'streak-6'].map((code) => ({ code, unlockedAt: at })),
}

describe('profile screen (#42)', () => {
  const open = gameReducer(lobby, { type: 'openProfile' })
  const loaded = gameReducer(gameReducer(open, profile), achievements)

  it('opens from the lobby with nothing loaded, and only from the lobby', () => {
    expect(open).toMatchObject({ screen: 'profile', profile: null, achievements: null, profileFailed: false })
    expect(gameReducer({ ...lobby, screen: 'game' }, { type: 'openProfile' }).screen).toBe('game')
  })

  it('a profile message fills the screen', () => {
    expect(loaded.profile).toEqual(saved)
    const html = render(loaded)
    expect(html).toContain('Alice')
    expect(html).toContain('Rank 3 · 8 wins')
    expect(html).toContain('3 of 3 chosen')
    expect(html).toContain('Best: 8 wins')
    expect(html).toContain('Best match: 73.0%')
    expect(html).toContain('Best: 6 in a row')
    // The chosen picture is ticked; the three shown badges are pressed.
    expect(html).toMatch(/class="profile-avatar on"><input[^>]*value="pufferfish"/)
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(3)
    // Nothing changed yet, so there is nothing to save.
    expect(html).toMatch(/<button type="button" class="btn wide" disabled="">Save profile/)
  })

  it('waits for both replies before showing the choices', () => {
    expect(render(gameReducer(open, profile))).toContain('Loading your profile')
    expect(render(gameReducer(open, achievements))).toContain('Loading your profile')
  })

  it('a guest can look, but Save is off with a note', () => {
    const guest = gameReducer(gameReducer(open, { type: 'profile', guest: true, avatar: '', shownBadges: [], rank: null, wins: 0 }),
      { type: 'achievements', wins: 0, bestAccuracy: 0, bestStreak: 0, badges: [] })
    const html = render(guest)
    expect(html).toContain('Not ranked yet · 0 wins')
    expect(html).toContain('Log in to save your picture and badges.')
    expect(html).toMatch(/class="btn wide" disabled="">Save profile/)
    // No picture: the first letter of the name instead.
    expect(html).toContain('<span class="avatar" style="background:var(--sun)" aria-hidden="true">A</span>')
    expect(gameReducer(guest, { type: 'saveProfile' })).toBe(guest)
  })

  it('an error while loading is the answer; opening again retries', () => {
    const failed = gameReducer(gameReducer(open, profile), { type: 'error', code: 'unknown', message: 'nope' })
    expect(failed.profileFailed).toBe(true)
    expect(render(failed)).toContain('Your profile couldn&#x27;t be loaded.')
    expect(gameReducer(failed, { type: 'openProfile' })).toMatchObject({ profile: null, achievements: null, profileFailed: false })
  })

  it('saving waits for the reply; a refused save keeps the screen and toasts why', () => {
    const saving = gameReducer(loaded, { type: 'saveProfile' })
    expect(saving.profileSaving).toBe(true)
    expect(render(saving)).toContain('Saving…')

    const refused = gameReducer(saving, { type: 'error', code: 'invalid-profile', message: 'You can only show badges you have earned.' })
    expect(refused).toMatchObject({ screen: 'profile', profile: saved, profileSaving: false, profileFailed: false })
    expect(refused.lastError?.message).toBe('You can only show badges you have earned.')

    const next = { ...saved, avatar: 'shark' }
    const done = gameReducer(saving, { type: 'profile', ...next })
    expect(done).toMatchObject({ profile: next, profileSaving: false })
  })

  it('Home goes to the lobby', () => {
    expect(gameReducer(loaded, { type: 'closeProfile' }).screen).toBe('lobby')
  })

  it('the socket accepts the profile event', () => {
    expect(parseServerEvent(JSON.stringify(profile))).toEqual(profile)
  })
})

describe('choosing badges to show', () => {
  const earned = ['wins-5', 'accuracy-40', 'accuracy-50', 'streak-4']

  it('stops at 3', () => {
    let shown: string[] = []
    for (const code of earned) shown = toggleBadge(shown, code, earned)
    expect(shown).toEqual(['wins-5', 'accuracy-40', 'accuracy-50'])
    expect(shown).toHaveLength(MAX_SHOWN)
  })

  it('only allows earned badges', () => {
    expect(toggleBadge([], 'wins-10', earned)).toEqual([])
    expect(toggleBadge([], 'made-up', ['made-up'])).toEqual([])
  })

  it('picking again unpicks, which makes room for another', () => {
    const full = ['wins-5', 'accuracy-40', 'accuracy-50']
    const two = toggleBadge(full, 'accuracy-40', earned)
    expect(two).toEqual(['wins-5', 'accuracy-50'])
    expect(toggleBadge(two, 'streak-4', earned)).toEqual(['wins-5', 'accuracy-50', 'streak-4'])
  })

  it('the screen offers locked badges and a fourth one as disabled', () => {
    const html = render(gameReducer(gameReducer(gameReducer(lobby, { type: 'openProfile' }), profile), achievements))
    // 15 medals: 3 chosen and pressable, 4 earned but the shelf is full, 8 locked.
    expect(html.match(/aria-pressed="true" aria-disabled="false"/g)).toHaveLength(3)
    expect(html.match(/aria-pressed="false" aria-disabled="true"/g)).toHaveLength(12)
    expect(html.match(/, Locked"/g)).toHaveLength(8)
  })

  it('knows when there is something to save; order counts', () => {
    expect(profileDirty(saved, 'pufferfish', ['wins-5', 'accuracy-70', 'streak-6'])).toBe(false)
    expect(profileDirty(saved, '', ['wins-5', 'accuracy-70', 'streak-6'])).toBe(true)
    expect(profileDirty(saved, 'pufferfish', ['streak-6', 'accuracy-70', 'wins-5'])).toBe(true)
    expect(profileDirty(saved, 'pufferfish', [])).toBe(true)
  })
})

it('speaks Thai', () => {
  const view: AchievementsView = { wins: 8, bestAccuracy: 73, bestStreak: 6, badges: [] }
  expect(rankLine(3, 8, 'th')).toBe('อันดับ 3 · ชนะ 8 ครั้ง')
  expect(chosenText(2, 'th')).toBe('เลือกแล้ว 2 จาก 3')
  expect(bestText('streak', view, 'th')).toBe('สูงสุด: ติดกัน 6 ครั้ง')
})

function render(state: GameState): string {
  return renderToStaticMarkup(
    createElement(ProfileScreen, {
      profile: state.profile,
      achievements: state.achievements,
      failed: state.profileFailed,
      saving: state.profileSaving,
      myName: state.myName,
      onHome: () => {},
      onRetry: () => {},
      onSave: () => {},
    }),
  )
}

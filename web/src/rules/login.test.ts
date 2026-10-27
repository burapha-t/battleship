import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { fieldsFor, initialOf, PASSWORD_MAX, PASSWORD_MIN, USERNAME_MAX, validate } from './login'
import { LoginScreen } from '../screens/LoginScreen'
import { NicknameScreen } from '../screens/NicknameScreen'

// The settings store has no server snapshot, so markup renders in English here.
vi.mock('../settings/useSettings', () => ({ useSettings: () => ({ language: 'en', musicVolume: 50, effectsVolume: 50 }) }))
// App reads the page's address for ?replay=; there is no page or socket here.
vi.mock('../state/useGameSocket', () => ({ useGameSocket: () => ({ send: () => {}, link: 'connecting' }) }))

describe('login and sign-up rules (#47)', () => {
  it('matches the server: usernames 1–16, passwords 4–16', () => {
    expect([USERNAME_MAX, PASSWORD_MIN, PASSWORD_MAX]).toEqual([16, 4, 16])
  })

  it('accepts names and passwords inside the limits', () => {
    expect(validate('Alice', 'abcd')).toBeNull()
    expect(validate('a'.repeat(16), 'x'.repeat(16))).toBeNull()
    expect(validate('A', 'abcd')).toBeNull()
  })

  it('trims the username before counting it', () => {
    expect(validate('  Alice  ', 'abcd')).toBeNull()
    expect(validate(' ' + 'a'.repeat(16) + ' ', 'abcd')).toBeNull()
    expect(validate('', 'abcd')).toBe('username')
    expect(validate('   ', 'abcd')).toBe('username')
    expect(validate('a'.repeat(17), 'abcd')).toBe('username')
  })

  it('never trims the password', () => {
    expect(validate('Alice', 'abc')).toBe('password')
    expect(validate('Alice', 'x'.repeat(17))).toBe('password')
    expect(validate('Alice', '')).toBe('password')
    // Four characters with the space: spaces count.
    expect(validate('Alice', ' abc')).toBeNull()
    expect(validate('Alice', '    ')).toBeNull()
  })

  it('names the username first when both are wrong', () => {
    expect(validate('', '')).toBe('username')
  })

  it('takes the first letter of the trimmed name for the card', () => {
    expect(initialOf('  alice')).toBe('A')
    expect(initialOf('สมชาย')).toBe('ส')
    expect(initialOf('   ')).toBeUndefined()
  })
})

describe('server answers on the login card (#47)', () => {
  it('marks the inputs each account error is about', () => {
    expect(fieldsFor('invalid-input')).toEqual(['username', 'password'])
    expect(fieldsFor('bad-credentials')).toEqual(['username', 'password'])
    expect(fieldsFor('username-taken')).toEqual(['username'])
    expect(fieldsFor('already-logged-in')).toEqual(['username'])
    // No database, or it failed: nothing typed is wrong.
    expect(fieldsFor('unknown')).toEqual([])
  })
})

describe('login card (#47)', () => {
  const card = (connected: boolean) =>
    renderToStaticMarkup(createElement(LoginScreen, { connected, lastError: null, onSend: () => {}, onGuest: () => {} }))

  it('opens on the Log in tab', () => {
    const html = card(true)
    expect(html).toMatch(/aria-selected="true"[^>]*>Log in</)
    expect(html).toMatch(/aria-selected="false"[^>]*>Sign up</)
    expect(html).toContain('Welcome back, captain!')
    expect(html).toMatch(/<button type="submit"[^>]*>Log in</)
  })

  it('limits both inputs to 16 characters and hides the password behind the eye', () => {
    const html = card(true)
    expect(html.match(/maxLength="16"/gi)).toHaveLength(2)
    expect(html).toMatch(/id="login-password" type="password"/)
    expect(html).toMatch(/aria-label="Show password"[^>]*aria-pressed="false"/)
  })

  it('waits for the server before it can send, and says so', () => {
    expect(card(false)).toMatch(/<button type="submit"[^>]*disabled/)
    expect(card(false)).toContain('Connecting to game server…')
    expect(card(true)).not.toMatch(/<button type="submit"[^>]*disabled/)
    expect(card(true)).toContain('Connected to game server automatically')
  })

  it('offers the guest path under the card', () => {
    expect(card(true)).toContain('Play as guest')
  })

  it('has no made-up ID number, stamp or anchor bar (design D3)', () => {
    const html = card(true)
    expect(html).not.toContain('ID no.')
    expect(html).not.toContain('Cleared to sail')
    expect(html).not.toContain('progressbar')
  })

  it('is the first screen, with the nickname screen behind "Play as guest"', () => {
    const html = renderToStaticMarkup(createElement(App))
    expect(html).toContain('id="login-username"')
    expect(html).not.toContain('Your nickname')
  })

  it('links the nickname screen back to the login card', () => {
    const html = renderToStaticMarkup(
      createElement(NicknameScreen, { connected: true, lastError: null, onJoin: () => {}, onLogin: () => {} }),
    )
    expect(html).toContain('Log in or sign up')
  })
})

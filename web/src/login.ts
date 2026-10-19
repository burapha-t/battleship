// Login and sign-up rules, kept out of React so they can be tested on their own.

import type { ErrorCode } from './protocol'

/** Same as the server's NicknamePolicy.MaxLength. */
export const USERNAME_MAX = 16
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 64

export type AuthMode = 'login' | 'signup'
export type AuthField = 'username' | 'password'

/** What to tell the player, and which inputs to mark. */
export type AuthProblem = { fields: AuthField[]; message: string }

/**
 * The first problem with what was typed, or null. Login only checks that both
 * are filled in; the length rules are for sign-up, so an old account is never
 * locked out by them. The username is trimmed, the password never is.
 */
export function validate(mode: AuthMode, username: string, password: string): AuthProblem | null {
  const name = username.trim()
  if (!name) return { fields: ['username'], message: 'Enter your username' }
  if (!password) return { fields: ['password'], message: 'Enter your password' }
  if (mode === 'signup') {
    if (name.length > USERNAME_MAX) return { fields: ['username'], message: 'Usernames are 1–16 characters' }
    if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX)
      return { fields: ['password'], message: 'Passwords are 8–64 characters' }
  }
  return null
}

/** The server's auth errors, as something to show. Other codes aren't about the form. */
export const AUTH_ERRORS: Partial<Record<ErrorCode, AuthProblem>> = {
  'bad-credentials': { fields: ['username', 'password'], message: "That username and password don't match" },
  'username-taken': { fields: ['username'], message: 'That username is taken' },
  'already-logged-in': { fields: ['username'], message: 'That captain is already aboard' },
  'invalid-input': { fields: ['username', 'password'], message: 'Usernames are 1–16 characters; passwords 8–64' },
  'bad-nickname': { fields: ['username'], message: 'Usernames are 1–16 characters' },
}

/** The first letter of a name, uppercased, as on an Avatar; undefined for a blank one. */
export function initialOf(name: string): string | undefined {
  return [...name.trim()][0]?.toUpperCase()
}

/**
 * A 4-digit ID for the login card, the same every time for the same name. It's
 * cosmetic: the server issues no ID before login.
 */
export function idNumberFor(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '----'
  let hash = 0
  for (let i = 0; i < trimmed.length; i++) hash = (Math.imul(hash, 31) + trimmed.charCodeAt(i)) | 0
  return String(Math.abs(hash) % 10000).padStart(4, '0')
}

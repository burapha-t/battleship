// Login and sign-up rules, kept out of React so they can be tested on their own.
// Both tabs use the same rules, and the server checks them again (protocol.md §5).

import type { ErrorCode } from '../protocol'

/** Same as the server's NicknamePolicy.MaxLength. */
export const USERNAME_MAX = 16
export const PASSWORD_MIN = 4
export const PASSWORD_MAX = 16

export type AuthMode = 'login' | 'signup'
export type AuthField = 'username' | 'password'

/**
 * The input that breaks the rules, or null if both are fine. The username is
 * trimmed before it is counted; the password never is, so spaces count.
 */
export function validate(username: string, password: string): AuthField | null {
  const name = username.trim()
  if (name.length < 1 || name.length > USERNAME_MAX) return 'username'
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) return 'password'
  return null
}

/** The inputs a server answer is about; none when it isn't about what was typed. */
export function fieldsFor(code: ErrorCode): AuthField[] {
  switch (code) {
    case 'invalid-input':
    case 'bad-credentials':
      return ['username', 'password']
    case 'username-taken':
    case 'already-logged-in':
      return ['username']
    default:
      return []
  }
}

/** The first letter of a name, uppercased, as on an Avatar; undefined for a blank one. */
export function initialOf(name: string): string | undefined {
  return [...name.trim()][0]?.toUpperCase()
}

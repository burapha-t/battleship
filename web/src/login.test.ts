import { describe, expect, it } from 'vitest'
import { AUTH_ERRORS, USERNAME_MAX, idNumberFor, validate } from './login'

describe('validate', () => {
  it.each(['login', 'signup'] as const)('%s: asks for the username first, then the password', (mode) => {
    expect(validate(mode, '', '')).toEqual({ fields: ['username'], message: 'Enter your username' })
    expect(validate(mode, '   ', 'hunter22')).toEqual({ fields: ['username'], message: 'Enter your username' })
    expect(validate(mode, 'alice', '')).toEqual({ fields: ['password'], message: 'Enter your password' })
  })

  it('accepts a good sign-up', () => {
    expect(validate('signup', 'alice', 'hunter22')).toBeNull()
  })

  it('sign-up: a username over 16 characters is too long, 16 is fine', () => {
    expect(validate('signup', 'a'.repeat(USERNAME_MAX + 1), 'hunter22')).toEqual({
      fields: ['username'],
      message: 'Usernames are 1–16 characters',
    })
    expect(validate('signup', 'a'.repeat(USERNAME_MAX), 'hunter22')).toBeNull()
  })

  it('trims the username before counting', () => {
    expect(validate('signup', `  ${'a'.repeat(USERNAME_MAX)}  `, 'hunter22')).toBeNull()
  })

  it('sign-up: a password must be 8–64 characters', () => {
    const problem = { fields: ['password'], message: 'Passwords are 8–64 characters' }
    expect(validate('signup', 'alice', 'a'.repeat(7))).toEqual(problem)
    expect(validate('signup', 'alice', 'a'.repeat(65))).toEqual(problem)
    expect(validate('signup', 'alice', 'a'.repeat(8))).toBeNull()
    expect(validate('signup', 'alice', 'a'.repeat(64))).toBeNull()
  })

  it('does not trim the password', () => {
    expect(validate('signup', 'alice', ' '.repeat(8))).toBeNull()
    expect(validate('signup', 'alice', ' abc ')).toMatchObject({ fields: ['password'] })
    expect(validate('login', 'alice', ' ')).toBeNull()
  })

  it('login skips the length checks', () => {
    expect(validate('login', 'a'.repeat(USERNAME_MAX + 5), 'x')).toBeNull()
    expect(validate('login', 'alice', 'a'.repeat(100))).toBeNull()
  })
})

describe('AUTH_ERRORS', () => {
  it('marks both fields for bad credentials', () => {
    expect(AUTH_ERRORS['bad-credentials']).toEqual({
      fields: ['username', 'password'],
      message: "That username and password don't match",
    })
  })

  it('marks the username when it is taken', () => {
    expect(AUTH_ERRORS['username-taken']).toEqual({ fields: ['username'], message: 'That username is taken' })
  })

  it("has nothing for errors that aren't about the form", () => {
    expect(AUTH_ERRORS['not-your-turn']).toBeUndefined()
  })
})

describe('idNumberFor', () => {
  it('is 4 digits and the same every time', () => {
    for (const name of ['Alice', 'Bob', 'a', 'Captain Haddock', 'ชื่อไทย'])
      expect(idNumberFor(name)).toMatch(/^\d{4}$/)
    expect(idNumberFor('Alice')).toBe(idNumberFor('Alice'))
  })

  it('ignores surrounding spaces', () => {
    expect(idNumberFor('  Alice ')).toBe(idNumberFor('Alice'))
  })

  it('differs between names', () => {
    expect(idNumberFor('Alice')).not.toBe(idNumberFor('Bob'))
  })

  it('is ---- for a blank name', () => {
    expect(idNumberFor('')).toBe('----')
    expect(idNumberFor('   ')).toBe('----')
  })
})

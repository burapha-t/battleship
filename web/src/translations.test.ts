/// <reference types="node" />
// #38: completeness, dynamic names, server errors, and future text coverage.
import { expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { translations, translator } from './translations'
import { localizeError, localizeMessage, localizePlacement } from './localizeMessage'
import { historyText } from './screens/historyText'
import { leaderboardText, wins } from './screens/leaderboardText'

it('every phrase has both languages with matching placeholders', () => {
  const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort()
  for (const [scope, phrases] of Object.entries(translations)) {
    for (const [key, pair] of Object.entries(phrases)) {
      expect(pair[0].trim(), `${scope}.${key} English`).not.toBe('')
      expect(pair[1].trim(), `${scope}.${key} Thai`).not.toBe('')
      if (/[a-zก-๙]/i.test(pair[1].replace(/\{\w+\}/g, '')))
        expect(pair[1], `${scope}.${key} needs Thai`).toMatch(/[ก-๙]/)
      expect(placeholders(pair[0]), `${scope}.${key} placeholders`).toEqual(placeholders(pair[1]))
    }
  }
})
it('interpolates whole phrases without changing player names or coordinates', () => {
  const t = translator('th', 'game')
  expect(t('welcome', { name: "Alice $& <3" })).toBe('ยินดีต้อนรับ Alice $& <3')
  expect(t('timeoutShot', { name: 'Bob', cell: 'A8' })).toContain('Bob หมดเวลา')
  expect(t('timeoutShot', { name: 'Bob', cell: 'A8' })).toContain('A8')
  expect(translator('en', 'game')('welcome', { name: 'Alice' })).toBe('Welcome, Alice.')
  expect(translator('en', 'game')('timerLabelOne', { label: 'Time left', count: 1 })).toBe('Time left: 1 second')
  expect(translator('en', 'game')('secondsOne')).toBe('second')
})
it('retains the existing history and leaderboard APIs for PR65', () => {
  expect(historyText('th')('title')).toBe('ประวัติการแข่งขัน')
  expect(leaderboardText('th')('title')).toBe('ทำเนียบกัปตันทั่วโลก')
  expect(wins(1, 'en')).toBe('1 win')
  expect(wins(2, 'en')).toBe('2 wins')
  expect(wins(2, 'th')).toBe('ชนะ 2 ครั้ง')
})
it('prepares all PR65 profile, creature, badge, rank and best-stat phrases', () => {
  const p = translator('th', 'profile')
  for (const code of ['whale','octopus','crab','pufferfish','turtle','jellyfish','starfish','shark'] as const) expect(p(code)).toMatch(/[ก-๙]/)
  expect(translator('th', 'profileValues')('chosen', { count: 2 })).toBe('เลือกแล้ว 2 จาก 3')
  expect(translator('th', 'profileValues')('rank', { rank: 3 })).toBe('อันดับ 3')
  for (const count of [5,10,20,50,100]) expect(translator('th', 'badgeValues')('wins', { count })).toBe(`ชนะ ${count} ครั้ง`)
  for (const count of [40,50,60,70,80]) expect(translator('th', 'badgeValues')('accuracy', { count })).toBe(`มากกว่า ${count}%`)
  for (const count of [4,6,8,10,12]) expect(translator('th', 'badgeValues')('streak', { count })).toBe(`ยิงโดนติดกัน ${count} ครั้ง`)
  expect(translator('th', 'badges')('newBadge')).toBe('ได้เหรียญตราใหม่!')
})
it('translates error codes first and safely handles unfamiliar server messages', () => {
  for (const code of ['unknown','bad-nickname','invalid-placement','not-your-turn','already-fired','out-of-range','not-in-match','invalid-profile','not-logged-in','invalid-input','username-taken','bad-credentials','already-logged-in']) {
    expect(localizeError({ code, message: 'A future server message' }, 'th')).toMatch(/[ก-๙]/)
  }
  expect(localizeError({ code: 'not-your-turn', message: 'You already fired at that cell.' }, 'th')).toBe('ยังไม่ถึงรอบยิงของคุณ')
  expect(localizeError({ code: 'future-code', message: 'Future English' }, 'th')).toBe('เกิดข้อผิดพลาด โปรดลองอีกครั้ง')
  expect(localizeError({ code: 'invalid-profile', message: 'You can only show badges you have earned.' }, 'th')).toBe('คุณแสดงได้เฉพาะเหรียญตราที่ได้รับแล้ว')
  expect(localizeError({ code: 'unknown', message: "Match history couldn't be loaded. Try again." }, 'th')).toContain('ประวัติการแข่งขัน')
  expect(localizeError({ code: 'unknown', message: "Your badges couldn't be loaded. Try again." }, 'th')).toBe('โหลดเหรียญตราไม่สำเร็จ โปรดลองอีกครั้ง')
  expect(localizeError({ code: 'unknown', message: "Your profile couldn't be loaded or saved. Try again." }, 'th')).toBe('โหลดหรือบันทึกโปรไฟล์ไม่สำเร็จ โปรดลองอีกครั้ง')
  expect(localizeError({ code: 'future', message: 'Keep English detail' }, 'en')).toBe('Keep English detail')
})
it('gives every login and sign-up answer its own sentence in both languages (#47)', () => {
  // English is the server's message, byte for byte (protocol.md §4).
  const english = {
    'invalid-input': 'Usernames must be 1-16 characters and passwords 4-16 characters.',
    'username-taken': 'That username is taken.',
    'bad-credentials': 'Wrong username or password.',
    'already-logged-in': 'That account is already logged in.',
  }
  const fallback = translator('th', 'errors')('unknown')
  const thai = new Set<string>()
  for (const [code, message] of Object.entries(english)) {
    expect(Object.hasOwn(translations.errors, code), code).toBe(true)
    expect(translations.errors[code as keyof typeof english][0]).toBe(message)
    expect(localizeError({ code, message }, 'en')).toBe(message)
    const th = localizeError({ code, message }, 'th')
    expect(th, code).not.toBe(fallback)
    thai.add(th)
  }
  expect(thai.size).toBe(4)
  // The two `unknown` answers are matched by their English message.
  for (const message of ["Accounts aren't available on this server. Play as a guest.", "Couldn't sign up or log in. Try again."]) {
    const th = localizeError({ code: 'unknown', message }, 'th')
    expect(th, message).toMatch(/[ก-๙]/)
    expect(th, message).not.toBe(fallback)
  }
  expect(localizeError({ code: 'unknown', message: 'You have already joined.' }, 'th')).toBe('คุณเข้าร่วมแล้ว')
})
it('has every login card label in both languages (#47)', () => {
  const en = translator('en', 'login')
  expect([en('logIn'), en('signUp'), en('loggingIn'), en('signingUp')]).toEqual(['Log in', 'Sign up', 'Logging in…', 'Signing up…'])
  expect(en('usernameRule')).toBe('Usernames must be 1–16 characters.')
  expect(en('passwordRule')).toBe('Passwords must be 4–16 characters.')
  const th = translator('th', 'login')
  for (const key of Object.keys(translations.login) as (keyof typeof translations.login)[]) expect(th(key), key).toMatch(/[ก-๙]/)
})
it('translates every placement reason while preserving its numbers', () => {
  for (const message of ['Place exactly 4 ships.', 'Ship 2 must cover exactly 4 cells.', 'Ship 2 is off the grid.', 'Ship 2 uses a cell that is already taken.', 'Ship 2 is not in a straight line.', 'Ship 2 has a gap between its cells.']) {
    expect(localizePlacement(message, 'th')).toMatch(/[ก-๙]/)
    expect(localizePlacement(message, 'en')).toBe(message)
  }
  expect(localizePlacement('Ship 2 is off the grid.', 'th')).toBe('เรือลำที่ 2 อยู่นอกตาราง')
  expect(localizePlacement(null, 'th')).toBeNull()
})
it('retranslates existing notices and fatal errors without changing reducer state', () => {
  const notice = { text: "Captain O'Brien left the game" }
  expect(localizeMessage(notice.text, 'th')).toBe("Captain O'Brien ออกจากเกมแล้ว")
  expect(notice.text).toBe("Captain O'Brien left the game")
  expect(localizeMessage('Your opponent left the game', 'th')).toBe('คู่แข่งของคุณ ออกจากเกมแล้ว')
  expect(localizeMessage('The server was reset', 'th')).toBe('เซิร์ฟเวอร์ถูกรีเซ็ต')
  expect(localizeMessage('This page speaks protocol v1, but the server speaks v2.', 'th')).toBe('หน้านี้รองรับโพรโทคอลรุ่น 1 แต่เซิร์ฟเวอร์ใช้รุ่น 2')
})
it('keeps new JSX text and accessible labels in the shared translation system', () => {
  const root = fileURLToPath(new URL('.', import.meta.url))
  const allowed = new Set(['Battle', 'ship', 'Battleship', 'English'])
  const failures: string[] = []
  for (const file of readdirSync(root, { recursive: true }).map(String).filter(f => f.endsWith('.tsx'))) {
    const source = ts.createSourceFile(file, readFileSync(root + file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    function visit(node: ts.Node) {
      const text = ts.isJsxText(node) ? node.text.trim() : ts.isJsxAttribute(node) && ['aria-label','title','placeholder'].includes(node.name.getText(source)) && node.initializer && ts.isStringLiteral(node.initializer) ? node.initializer.text : ''
      if (/[a-z]{2}/i.test(text) && !allowed.has(text)) failures.push(`${file}: ${text}`)
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  expect(failures).toEqual([])
})

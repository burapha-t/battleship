import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { initialState } from '../state/gameReducer'
import { Header } from './Header'
import { QuitGameModal } from './QuitGameModal'

vi.mock('../settings/useSettings', () => ({ useSettings: () => ({ language: 'en' }) }))

it('renders the custom confirmation copy and accessible dialog actions', () => {
  const html = renderToStaticMarkup(createElement(QuitGameModal, { onClose: () => {}, onConfirm: () => {} }))
  expect(html).toContain('<dialog')
  expect(html).toContain('aria-modal="true"')
  expect(html).toContain('aria-labelledby="quit-modal-title"')
  expect(html).toContain('aria-describedby="quit-modal-description"')
  expect(html).toContain('Quit Game?')
  expect(html).toContain('Are you sure you want to leave your match against Ghost Fleet?')
  expect(html).toContain('Keep Playing')
  expect(html).not.toContain('<svg')
  expect(html.match(/type="button"/g)).toHaveLength(2)
})

it('places the bot-only quit trigger immediately before Settings in the header', () => {
  const state = { ...initialState, screen: 'game' as const, gameMode: 'bot' as const }
  const withQuit = renderToStaticMarkup(createElement(Header, {
    state, nav: null, onQuitGame: () => {}, onOpenSettings: () => {},
  }))
  expect(withQuit.indexOf('aria-label="Quit Game"')).toBeGreaterThan(-1)
  expect(withQuit.indexOf('aria-label="Quit Game"')).toBeLessThan(withQuit.indexOf('aria-label="Settings"'))
  expect(withQuit).toContain('class="iconbtn danger"')

  const withoutQuit = renderToStaticMarkup(createElement(Header, {
    state, nav: null, onOpenSettings: () => {},
  }))
  expect(withoutQuit).not.toContain('aria-label="Quit Game"')
})

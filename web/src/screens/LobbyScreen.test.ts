import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { initialState } from '../state/gameReducer'
import { LobbyScreen } from './LobbyScreen'

// The browser settings store has no server-rendering snapshot.
vi.mock('../settings/useSettings', () => ({ useSettings: () => ({ language: 'en' }) }))

it('offers Ghost Fleet alongside public matchmaking and disables both during launch', () => {
  const render = (searching: boolean, ghostStarting: boolean) => renderToStaticMarkup(createElement(LobbyScreen, {
    state: { ...initialState, screen: 'lobby', myName: 'Alice' }, searching, ghostStarting,
    onStartGame: () => {}, onStartGhost: () => {},
  }))
  expect(render(false, false)).toContain('Play vs Bot')
  expect(render(false, false)).toContain('Play vs player')
  const loading = render(true, true)
  expect(loading).toContain('Starting Ghost Fleet')
  expect(loading.match(/disabled=""/g)).toHaveLength(2)
})

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { initialState } from '../state/gameReducer'
import { LobbyScreen } from './LobbyScreen'

// The browser settings store has no server-rendering snapshot.
vi.mock('../settings/useSettings', () => ({ useSettings: () => ({ language: 'en' }) }))

it('replaces Play vs Bot with Cancel Search while public matchmaking is active', () => {
  const render = (publicSearching: boolean, ghostStarting: boolean) => renderToStaticMarkup(createElement(LobbyScreen, {
    state: { ...initialState, screen: 'lobby', myName: 'Alice' }, publicSearching, ghostStarting,
    onStartGame: () => {}, onStartGhost: () => {}, onCancelSearch: () => {},
  }))
  expect(render(false, false)).toContain('Play vs Bot')
  expect(render(false, false)).toContain('Play vs player')
  const loading = render(true, false)
  expect(loading).toContain('Looking for an opponent')
  expect(loading).toContain('Cancel Search')
  expect(loading).toContain('cancel-search')
  expect(loading.match(/disabled=""/g)).toHaveLength(1)

  const startingBot = render(false, true)
  expect(startingBot).toContain('Starting Ghost Fleet')
  expect(startingBot.match(/disabled=""/g)).toHaveLength(2)
})

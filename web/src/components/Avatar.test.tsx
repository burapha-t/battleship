import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { initialState } from '../state/gameReducer'
import type { GameState } from '../state/gameReducer'
import { Avatar } from './Avatar'
import { Header } from './Header'
import { SeaAvatar } from './SeaAvatar'

vi.mock('../settings/useSettings', () => ({ useSettings: () => ({ language: 'en' }) }))

const html = (props: { name: string | null; avatar?: string }) =>
  renderToStaticMarkup(createElement(Avatar, { color: 'var(--sun)', ...props }))
const picture = (code: string) => renderToStaticMarkup(createElement(SeaAvatar, { code }))

describe('Avatar (#77)', () => {
  it('draws the saved picture when it has a code', () => {
    expect(html({ name: 'Alice', avatar: 'shark' })).toContain(picture('shark'))
    expect(html({ name: 'Alice', avatar: 'shark' })).not.toContain('>A<')
  })

  it('without a code, or with "", draws the first letter', () => {
    expect(html({ name: 'alice' })).toBe('<span class="avatar" style="background:var(--sun)" aria-hidden="true">A</span>')
    expect(html({ name: 'alice', avatar: '' })).toBe(html({ name: 'alice' }))
    expect(html({ name: null })).toContain('>?</span>')
  })

  it('Ghost Fleet keeps its mascot', () => {
    expect(html({ name: 'Ghost Fleet', avatar: '' })).toContain(picture('ghost'))
    expect(html({ name: 'Ghost Fleet (2)' })).toContain(picture('ghost'))
  })
})

describe('header chips', () => {
  const render = (state: GameState) =>
    renderToStaticMarkup(createElement(Header, { state, nav: null, onOpenSettings: () => {} }))

  it('on Home, my chip shows my picture from my lobby entry', () => {
    const state: GameState = {
      ...initialState, screen: 'lobby', myId: 'p1', myName: 'Alice',
      lobby: [{ id: 'p1', name: 'Alice', status: 'idle', avatar: 'shark' }],
    }
    expect(render(state)).toContain(picture('shark'))
  })

  it('in a match, both chips show their picture, or a letter without one', () => {
    const state: GameState = {
      ...initialState, screen: 'game', myId: 'p1', myName: 'Alice',
      players: [
        { id: 'p1', name: 'Alice', score: 0, avatar: 'shark' },
        { id: 'p2', name: 'Bob', score: 0, avatar: '' },
      ],
    }
    const out = render(state)
    expect(out).toContain(picture('shark'))
    expect(out).toContain('aria-hidden="true">B</span>')
  })
})

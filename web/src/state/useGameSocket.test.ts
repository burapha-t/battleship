import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ClientVerb } from '../protocol'
import { useGameSocket } from './useGameSocket'

/** The hook's `send`, from one server render; effects don't run, so no socket opens. */
function sendAt(search: string): (verb: ClientVerb) => void {
  vi.stubGlobal('window', { location: { search, protocol: 'http:', host: 'localhost' } })
  const sends: ((verb: ClientVerb) => void)[] = []
  renderToStaticMarkup(createElement(Probe, { onSend: (send) => sends.push(send) }))
  return sends[0]
}

function Probe({ onSend }: { onSend: (send: (verb: ClientVerb) => void) => void }) {
  onSend(useGameSocket(() => {}).send)
  return null
}

const secret = 'hunter22'
const verbs: ClientVerb[] = [
  { type: 'login', username: 'Alice', password: secret },
  { type: 'signup', username: 'Alice', password: secret },
]

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('sending never logs a password (#47)', () => {
  it('logs only the verb type when there is no connection', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const send = sendAt('')
    for (const verb of verbs) send(verb)
    expect(warn).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(warn.mock.calls)).not.toContain(secret)
    expect(warn.mock.calls.map((call) => call.at(-1))).toEqual(['login', 'signup'])
  })

  it('logs only the verb type in replay mode', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const send = sendAt('?replay=p1')
    for (const verb of verbs) send(verb)
    expect(info).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(info.mock.calls)).not.toContain(secret)
    expect(info.mock.calls.map((call) => call.at(-1))).toEqual(['login', 'signup'])
  })
})

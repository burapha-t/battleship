// The UI's link to the local Battleship.Client relay (CLI-0): one WebSocket at
// /ws = one TCP connection = one player. One WebSocket text message is exactly
// one JSON frame. A reload is a new player; there is no reconnecting (§9).

import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import type { GameAction } from './gameReducer'
import type { ClientVerb, ServerEvent } from './protocol'
import { startReplay } from './replay'

export type Link = 'connecting' | 'open' | 'closed'

// A Record so the build fails if protocol.ts gains an event this list lacks.
const EVENT_TYPES: Record<ServerEvent['type'], true> = {
  connected: true,
  welcome: true,
  lobby: true,
  matchStart: true,
  placed: true,
  turn: true,
  fireResult: true,
  matchEnd: true,
  rematchPending: true,
  opponentLeft: true,
  reset: true,
  error: true,
}

/**
 * One frame → a typed event, or null. Malformed JSON and unknown `type`s are
 * logged and skipped, never thrown (protocol §1); unknown fields pass through.
 */
export function parseServerEvent(text: string): ServerEvent | null {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    console.warn('Skipped a malformed frame:', text)
    return null
  }
  const type = (value as { type?: unknown } | null)?.type
  if (typeof type !== 'string' || !Object.hasOwn(EVENT_TYPES, type)) {
    console.warn('Skipped a frame with an unknown type:', text)
    return null
  }
  return value as ServerEvent
}

/**
 * Opens the socket on mount and closes it on unmount (StrictMode's double
 * mount in dev therefore leaves no ghost connection). With `?replay=<id>` it
 * opens nothing and plays that player's side of the golden transcript.
 */
export function useGameSocket(onEvent: (event: GameAction) => void): {
  send: (verb: ClientVerb) => void
  link: Link
} {
  const [replayPlayer] = useState(() => new URLSearchParams(window.location.search).get('replay'))
  const [link, setLink] = useState<Link>(replayPlayer ? 'open' : 'connecting')
  const socket = useRef<WebSocket | null>(null)
  const emit = useEffectEvent(onEvent)

  useEffect(() => {
    if (replayPlayer) return startReplay(replayPlayer, (action) => emit(action))

    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${scheme}://${window.location.host}/ws`)
    socket.current = ws
    ws.onopen = () => setLink('open')
    ws.onclose = () => setLink('closed')
    ws.onmessage = (message) => {
      const event = typeof message.data === 'string' ? parseServerEvent(message.data) : null
      if (event) emit(event)
    }
    return () => {
      ws.onclose = ws.onmessage = null
      // Closing while still connecting makes the browser log an error, so a
      // socket that isn't open yet closes the moment it opens.
      if (ws.readyState === WebSocket.CONNECTING) ws.onopen = () => ws.close()
      else ws.close()
      socket.current = null
    }
  }, [replayPlayer])

  const send = useCallback((verb: ClientVerb) => {
    if (replayPlayer) {
      console.info('[replay] send', verb)
      return
    }
    const ws = socket.current
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(verb))
    else console.warn('Not connected; dropped', verb)
  }, [replayPlayer])

  return { send, link }
}

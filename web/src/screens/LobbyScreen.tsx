import { useEffect, useState } from 'react'
import { getGhostStatus, startGhostFleet, stopGhostFleet } from '../aiClient'
import { Avatar } from '../components/Avatar'
import { Hero } from '../components/Hero'
import type { GameState } from '../gameReducer'
import type { LobbyClient, LobbyStatus } from '../protocol'
import './screens.css'
import './ai.css'

const STATUS: Record<LobbyStatus, { label: string; dot: string }> = {
  connecting: { label: 'Connecting…', dot: 'grey' },
  idle: { label: 'Idle', dot: '' },
  searching: { label: 'Searching', dot: 'sun' },
  placing: { label: 'Placing ships', dot: 'lilac' },
  'in-match': { label: 'In a match', dot: 'coral' },
}

const OTHER_COLORS = ['var(--lilac)', 'var(--peach)', 'var(--kelp)']

export function LobbyScreen({ state, onStartGame }: { state: GameState; onStartGame: () => void }) {
  // The lobby list I had when I pressed Start game. Until the server sends a
  // new one, trust the press; after that, trust my status in the list.
  const [pressedAt, setPressedAt] = useState<LobbyClient[] | null>(null)
  const [ghostBusy, setGhostBusy] = useState(false)
  const [ghostRunning, setGhostRunning] = useState(false)
  const [ghostMessage, setGhostMessage] = useState('')

  const myStatus = state.lobby.find((c) => c.id === state.myId)?.status
  const searching = myStatus === 'searching' || pressedAt === state.lobby

  useEffect(() => {
    void getGhostStatus()
      .then((status) => {
        setGhostRunning(status.running)
        if (status.running) setGhostMessage(status.message)
      })
      .catch(() => {
        // The base lobby still works if the optional local AI API is missing.
      })
  }, [])

  const start = () => {
    setPressedAt(state.lobby)
    onStartGame()
  }

  const playGhost = async () => {
    if (!state.myName || searching || ghostBusy) return
    setGhostBusy(true)
    setGhostMessage('Starting Ghost Fleet…')
    try {
      const status = await startGhostFleet(state.myName)
      setGhostRunning(status.running)
      setGhostMessage(status.message)
      setPressedAt(state.lobby)
      onStartGame()
    } catch (error) {
      setGhostMessage(error instanceof Error ? error.message : 'Could not start Ghost Fleet')
    } finally {
      setGhostBusy(false)
    }
  }

  const stopGhost = async () => {
    if (ghostBusy) return
    setGhostBusy(true)
    try {
      const status = await stopGhostFleet()
      setGhostRunning(status.running)
      setGhostMessage(status.message)
    } catch (error) {
      setGhostMessage(error instanceof Error ? error.message : 'Could not stop Ghost Fleet')
    } finally {
      setGhostBusy(false)
    }
  }

  return (
    <main className="home">
      <Hero />
      <aside className="home-side">
        <div className="card join">
          <h2>Welcome, {state.myName}.</h2>
          <p className="hint">
            {searching
              ? 'You will be paired with the next captain who presses Start game.'
              : "Press Start game for a human match, or challenge your AI Ghost."}
          </p>

          <div className="ghost-actions">
            <button type="button" className="btn wide" disabled={searching || ghostBusy} onClick={start}>
              {searching ? 'Looking for an opponent…' : 'Start game'}
            </button>

            <button type="button" className="btn wide ghost-play" disabled={searching || ghostBusy} onClick={playGhost}>
              {ghostBusy ? 'Starting AI…' : `Play vs Ghost Fleet`}
            </button>

            {ghostRunning && (
              <button type="button" className="ghost-stop" disabled={ghostBusy} onClick={stopGhost}>
                Stop Ghost Fleet
              </button>
            )}
          </div>

          {ghostMessage && <p className="ghost-message" role="status">{ghostMessage}</p>}
        </div>

        <section className="card lobby" aria-labelledby="lobby-title">
          <div className="lobby-head">
            <h3 id="lobby-title">Captains online</h3>
            <span className="count">{state.lobby.length}</span>
          </div>
          <ul>
            {state.lobby.map((client, i) => {
              const you = client.id === state.myId
              const status = STATUS[client.status] ?? STATUS.idle
              return (
                <li key={client.id} className="who">
                  <Avatar name={client.name} color={you ? 'var(--sun)' : client.name ? OTHER_COLORS[i % OTHER_COLORS.length] : '#C3D3E3'} />
                  <span className="who-name">
                    {client.name ?? <em>connecting…</em>}
                    {you && <small>That's you</small>}
                  </span>
                  <span className="pill">
                    <span className={`dot ${status.dot}`} />
                    {status.label}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      </aside>
    </main>
  )
}

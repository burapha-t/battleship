import { useState } from 'react'
import { Avatar } from '../components/Avatar'
import { Hero } from '../components/Hero'
import type { GameState } from '../gameReducer'
import type { LobbyClient, LobbyStatus } from '../protocol'
import './screens.css'

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
  const myStatus = state.lobby.find((c) => c.id === state.myId)?.status
  const searching = myStatus === 'searching' || pressedAt === state.lobby

  const start = () => {
    setPressedAt(state.lobby)
    onStartGame()
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
              : "Press Start game when you're ready to play."}
          </p>
          <button type="button" className="btn wide" disabled={searching} onClick={start}>
            {searching ? 'Looking for an opponent…' : 'Start game'}
          </button>
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

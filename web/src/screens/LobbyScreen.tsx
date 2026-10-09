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

type Props = {
  state: GameState
  /** The link to the game server is open. */
  connected: boolean
  onStartGame: () => void
}

export function LobbyScreen({ state, connected, onStartGame }: Props) {
  // The lobby list I had when I pressed Start playing. Until the server sends a
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
          <h2>Ahoy, captain {state.myName}</h2>
          <button type="button" className="btn wide" disabled={searching} onClick={start}>
            {searching ? 'Looking for an opponent…' : 'Start playing'}
          </button>
          <p className="conn">
            <span className={connected ? 'dot' : 'dot coral'} />
            {connected ? 'Connected to game server automatically' : 'Disconnected from game server'}
          </p>
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

import { useState } from 'react'
import { matchSides } from '../gameReducer'
import type { GameState } from '../gameReducer'
import './screens.css'

const CONFETTI = ['var(--coral)', 'var(--kelp)', 'var(--lilac)', 'var(--sun)']

/** Win or Lost from `matchEnd.winnerId`, both scores, and the rematch handshake. */
export function EndScreen({ state, onRematch }: { state: GameState; onRematch: () => void }) {
  const { me, opponent } = matchSides(state)
  const opponentName = opponent?.name ?? 'Your opponent'
  const won = state.winnerId !== null && state.winnerId === state.myId

  const [pressed, setPressed] = useState(false)
  const iAsked = pressed || (state.myId !== null && state.rematchFrom.includes(state.myId))
  const theyAsked = opponent !== undefined && state.rematchFrom.includes(opponent.id)

  const rematch = () => {
    setPressed(true)
    onRematch()
  }

  const sides = [me, opponent].filter((p) => p !== undefined)
  const top = Math.max(...sides.map((p) => p.score))

  return (
    <main className="end">
      <div className={`card result ${won ? 'win' : 'lost'}`}>
        {won &&
          Array.from({ length: 12 }, (_, i) => (
            <span
              key={i}
              className="confetti"
              style={{
                left: `${4 + i * 8}%`,
                top: `${8 + ((i * 29) % 70)}%`,
                background: CONFETTI[i % CONFETTI.length],
                animationDelay: `-${i * 0.6}s`,
              }}
              aria-hidden
            />
          ))}
        <h1 className="status">{won ? 'Win' : 'Lost'}</h1>
        <p className="line">
          {won ? `You sank all 4 of ${opponentName}'s ships!` : `${opponentName} sank your whole fleet this time.`}
        </p>
        <div className="scores">
          {sides.map((p, i) => (
            <div key={p.id} className="score-pair">
              {i > 0 && <span className="vs">vs</span>}
              <div className={`sc${p.score === top ? ' lead' : ''}`}>
                <div className="n">
                  {p.name}
                  {p.id === state.myId && ' (you)'}
                </div>
                <div className="v">{p.score}</div>
              </div>
            </div>
          ))}
        </div>
        <button type="button" className={`btn big${iAsked ? ' pressed' : ''}`} disabled={iAsked} onClick={rematch}>
          {iAsked ? 'Rematch requested' : 'Rematch'}
        </button>
        {iAsked ? (
          <p className="note" role="status">
            <span className="dot sun" />
            Waiting for {opponentName}…
          </p>
        ) : (
          theyAsked && (
            <p className="note" role="status">
              <span className="dot" />
              {opponentName} wants a rematch{won ? ". You'll fire first as the winner." : '.'}
            </p>
          )
        )}
      </div>
    </main>
  )
}

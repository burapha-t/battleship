import { usePreferences } from '../preferences'
import { useState } from 'react'
import { matchSides } from '../gameReducer'
import type { GameState } from '../gameReducer'
import './screens.css'

const CONFETTI = ['var(--coral)', 'var(--kelp)', 'var(--lilac)', 'var(--sun)']

/** Win or Lost from `matchEnd.winnerId`, both scores, and the rematch handshake. */
export function EndScreen({ state, onRematch }: { state: GameState; onRematch: () => void }) {
  const { t } = usePreferences()
  const { me, opponent } = matchSides(state)
  const opponentName = opponent?.name ?? t('Your opponent', 'คู่แข่งของคุณ')
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
        <h1 className="status">{won ? t('Win', 'ชนะ') : t('Lost', 'แพ้')}</h1>
        <p className="line">
          {won ? t(`You sank all 4 of ${opponentName}'s ships!`, `คุณจมเรือทั้ง 4 ลำของ ${opponentName} ได้แล้ว!`) : t(`${opponentName} sank your whole fleet this time.`, `${opponentName} จมกองเรือของคุณทั้งหมดในรอบนี้`)}
        </p>
        <div className="scores">
          {sides.map((p, i) => (
            <div key={p.id} className="score-pair">
              {i > 0 && <span className="vs">vs</span>}
              <div className={`sc${p.score === top ? ' lead' : ''}`}>
                <div className="n">
                  {p.name}
                  {p.id === state.myId && t(' (you)', ' (คุณ)')}
                </div>
                <div className="v">{p.score}</div>
              </div>
            </div>
          ))}
        </div>
        <button type="button" className={`btn big${iAsked ? ' pressed' : ''}`} disabled={iAsked} onClick={rematch}>
          {iAsked ? t('Rematch requested', 'ส่งคำขอแข่งใหม่แล้ว') : t('Rematch', 'แข่งใหม่')}
        </button>
        {iAsked ? (
          <p className="note" role="status">
            <span className="dot sun" />
            {t(`Waiting for ${opponentName}…`, `กำลังรอ ${opponentName}…`)}
          </p>
        ) : (
          theyAsked && (
            <p className="note" role="status">
              <span className="dot" />
              {t(`${opponentName} wants a rematch${won ? ". You'll fire first as the winner." : '.'}`, `${opponentName} ต้องการแข่งใหม่${won ? ' คุณจะได้ยิงก่อนในฐานะผู้ชนะ' : ''}`)}
            </p>
          )
        )}
      </div>
    </main>
  )
}

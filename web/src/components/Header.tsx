import { usePreferences } from '../preferences'
import { matchSides } from '../gameReducer'
import type { GameState } from '../gameReducer'
import { Avatar } from './Avatar'

/**
 * Logo, names and scores, and the mute toggle. In a match it shows both
 * players; outside one, my name and last known score (`lobby` carries none).
 */
export function Header({ state }: { state: GameState }) {
  const { me, opponent } = matchSides(state)
  const inMatch = state.screen === 'placement' || state.screen === 'game' || state.screen === 'end'
  const active = state.screen === 'game' ? state.turn?.activePlayerId : undefined

  return (
    <header className="header">
      <div className="logo">
        <b>Battle</b>ship
      </div>
      <div className="scoreboard">
        {inMatch && me && opponent ? (
          <>
            <PlayerChip name={me.name} score={me.score} you turn={active === me.id} />
            <span className="vs">vs</span>
            <PlayerChip name={opponent.name} score={opponent.score} turn={active === opponent.id} />
          </>
        ) : (
          state.myName !== null && <PlayerChip name={state.myName} score={state.myScore} you />
        )}
      </div>
      <SoundToggle />
    </header>
  )
}

type ChipProps = { name: string; score: number; you?: boolean; turn?: boolean }

function PlayerChip({ name, score, you = false, turn = false }: ChipProps) {
  const { t } = usePreferences()
  return (
    <div className={`chip${you ? ' me' : ''}${turn ? ' turn' : ''}`}>
      <Avatar name={name} color={you ? 'var(--sun)' : 'var(--lilac)'} />
      <span className="name">
        {name}
        <small>{you ? t('You', 'คุณ') : t('Opponent', 'คู่แข่ง')}</small>
      </span>
      <span className="score" title={t('Score', 'คะแนน')}>
        {score}
      </span>
    </div>
  )
}

function SoundToggle() {
  const { effects, toggleEffects, t } = usePreferences()
  const muted = !effects
  return (
    <button type="button" className="btn white small sound" onClick={toggleEffects}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
        {muted ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12" />}
      </svg>
      {muted ? t('Sound off', 'ปิดเสียง') : t('Sound on', 'เปิดเสียง')}
    </button>
  )
}

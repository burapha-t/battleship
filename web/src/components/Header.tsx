import { matchSides } from '../gameReducer'
import type { GameState } from '../gameReducer'
import { useSettings } from '../useSettings'
import { Avatar } from './Avatar'

/**
 * Logo, names and scores, and the device settings menu. In a
 * match it shows both players; outside one, my name and last known score
 * (`lobby` carries none).
 */
export function Header({ state, onOpenSettings }: { state: GameState; onOpenSettings: () => void }) {
  const { language } = useSettings()
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
      <button type="button" className="btn white small sound" onClick={onOpenSettings} aria-haspopup="dialog">
        <span aria-hidden>⚙</span> {language === 'th' ? 'การตั้งค่า' : 'Settings'}
      </button>
    </header>
  )
}

type ChipProps = { name: string; score: number; you?: boolean; turn?: boolean }

function PlayerChip({ name, score, you = false, turn = false }: ChipProps) {
  return (
    <div className={`chip${you ? ' me' : ''}${turn ? ' turn' : ''}`}>
      <Avatar name={name} color={you ? 'var(--sun)' : 'var(--lilac)'} />
      <span className="name">
        {name}
        <small>{you ? 'You' : 'Opponent'}</small>
      </span>
      <span className="score" title="Score">
        {score}
      </span>
    </div>
  )
}

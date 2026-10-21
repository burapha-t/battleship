import { matchSides } from '../gameReducer'
import type { GameState } from '../gameReducer'
import type { ReactNode } from 'react'
import { useSettings } from '../useSettings'
import { Avatar } from './Avatar'

/** The lobby's screens, opened from icon buttons in the header. Off while I'm searching for a match. */
export type Nav = {
  disabled: boolean
  onHistory: () => void
  onLeaderboard: () => void
  onBadges: () => void
  onProfile: () => void
}

/**
 * Logo, names and scores, and a row of icon buttons (docs/frontend/1_home.html
 * `.topnav`): the lobby's screens when `nav` is given, then the device
 * settings menu. In a match it shows both players; outside one, my name and
 * last known score (`lobby` carries none).
 */
export function Header({ state, nav, onOpenSettings }: { state: GameState; nav: Nav | null; onOpenSettings: () => void }) {
  const { language } = useSettings()
  const th = language === 'th'
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
      <nav className="topnav">
        {nav && (
          <>
            <IconButton label={th ? 'กระดานผู้นำ' : 'Leaderboard'} disabled={nav.disabled} onClick={nav.onLeaderboard}>
              <svg viewBox="0 0 24 24" aria-hidden fill="none" stroke="#14325A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4h10v4.5a5 5 0 0 1-10 0z" fill="#FFC83D"/><path d="M7 6H4.5c0 2.4 1.2 4 3.2 4.2M17 6h2.5c0 2.4-1.2 4-3.2 4.2M12 13.5V17"/><rect x="8" y="17" width="8" height="3.5" rx="1" fill="#FFC83D"/></svg>
            </IconButton>
            <IconButton label={th ? 'ประวัติการแข่งขัน' : 'Match history'} disabled={nav.disabled} onClick={nav.onHistory}>
              <svg viewBox="0 0 24 24" aria-hidden fill="none" stroke="#14325A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.2 13A8 8 0 1 0 6.3 6.3" fill="none"/><path d="M3.5 3.5v4.2h4.2"/><circle cx="12" cy="12.5" r="5.2" fill="#E6F1FB" stroke="none"/><path d="M12 8.5v4.2l2.8 1.8"/></svg>
            </IconButton>
            <IconButton label={th ? 'เหรียญตรา' : 'Badges'} disabled={nav.disabled} onClick={nav.onBadges}>
              <svg viewBox="0 0 24 24" aria-hidden fill="none" stroke="#14325A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.5 2.5H11l2 6.5H9.5z" fill="#E6F1FB"/><path d="M16.5 2.5H13l-2 6.5h3.5z" fill="#E6F1FB"/><circle cx="12" cy="15" r="6" fill="#FFC83D"/><circle cx="12" cy="15" r="2.4"/></svg>
            </IconButton>
            <IconButton label={th ? 'โปรไฟล์' : 'Profile'} disabled={nav.disabled} onClick={nav.onProfile}>
              <svg viewBox="0 0 24 24" aria-hidden fill="none" stroke="#14325A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8.5" r="4.2" fill="#FFC83D"/><path d="M4.5 20.5c.8-4 3.8-6.3 7.5-6.3s6.7 2.3 7.5 6.3z" fill="#FFC83D"/></svg>
            </IconButton>
          </>
        )}
        <IconButton label={th ? 'การตั้งค่า' : 'Settings'} onClick={onOpenSettings} dialog>
          <svg viewBox="0 0 24 24" aria-hidden fill="none" stroke="#14325A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <rect key={deg} x="10.4" y="1.6" width="3.2" height="4.4" rx="1" fill="#14325A" stroke="none" transform={`rotate(${deg} 12 12)`} />
            ))}
            <circle cx="12" cy="12" r="6.6" fill="#fff"/><circle cx="12" cy="12" r="2.6" fill="#FFC83D"/>
          </svg>
        </IconButton>
      </nav>
    </header>
  )
}

type IconButtonProps = { label: string; disabled?: boolean; dialog?: boolean; onClick: () => void; children: ReactNode }

/** Icon only, so the name is its aria-label and its hover tooltip. */
function IconButton({ label, disabled = false, dialog = false, onClick, children }: IconButtonProps) {
  return (
    <button type="button" className="iconbtn" aria-label={label} title={label} disabled={disabled} onClick={onClick}
      aria-haspopup={dialog ? 'dialog' : undefined}>
      {children}
    </button>
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

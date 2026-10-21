// Achievements (#41): the same medal in the picker, shelf and unlock card.
import { BADGES } from '../badges'
import './Medal.css'
const ICONS = {
  wins: (<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4h10v4.5a5 5 0 0 1-10 0z"/><path d="M7 6H4.5c0 2.4 1.2 4 3.2 4.2M17 6h2.5c0 2.4-1.2 4-3.2 4.2M12 13.5V17M8 20.5h8"/></svg>),
  accuracy: (<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.5"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/></svg>),
  streak: (<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3c1.5 4 6 6 6 11.5a6 6 0 0 1-12 0c0-3 1.6-4.8 3-6 0 2 .8 3.3 2 3.8-.4-3.8 0-6.8 1-9.3z"/></svg>),
}
export function Medal({ code, earned = true, chosen = false }: { code: string; earned?: boolean; chosen?: boolean }) {
  const badge = BADGES.find(b => b.code === code)
  if (!badge) return null
  return <span className={`badge-wrap${earned ? '' : ' badge-locked'}${chosen ? ' badge-chosen' : ''}`} aria-hidden>
    <span className="badge-medal" style={{ background: badge.colour, color: badge.white ? '#fff' : 'var(--ink)' }}>
      {ICONS[badge.group]}<span>{badge.number}</span>
    </span>
    {!earned && <span className="badge-chip"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><rect x="5.5" y="10.5" width="13" height="10" rx="2.5" fill="#fff" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></svg></span>}
    {chosen && <span className="badge-chip badge-tick">✓</span>}
  </span>
}

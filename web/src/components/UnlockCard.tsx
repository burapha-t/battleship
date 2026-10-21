// Achievement notification (#41): server-approved badges for the current match.
import type { BadgeUnlock } from '../protocol'
import { useSettings } from '../useSettings'
import { badgeLabel, badgesText } from '../screens/badgesText'
import { Medal } from './Medal'
import './UnlockCard.css'
export function UnlockCard({ badges }: { badges: BadgeUnlock[] }) {
  const { language } = useSettings()
  if (!badges.length) return null
  return <section className="card unlock-card" role="status" lang={language}>
    <h2>{badgesText(language)(badges.length === 1 ? 'newBadge' : 'newBadges')}</h2>
    <div>{badges.map(b => <div key={b.code}><Medal code={b.code} /><span>{badgeLabel(b.code, language)}</span></div>)}</div>
  </section>
}

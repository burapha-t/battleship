// Achievement notification (#41): server-approved badges for the current match.
import type { BadgeUnlock } from '../protocol'
import { badgeLabel } from '../badges'
import { useSettings } from '../useSettings'
import { profileText } from '../screens/profileText'
import { Medal } from './Medal'
import './UnlockCard.css'
export function UnlockCard({ badges }: { badges: BadgeUnlock[] }) {
  const { language } = useSettings()
  if (!badges.length) return null
  return <section className="card unlock-card" role="status" lang={language}>
    <h2>{profileText(language)('newBadge')}</h2>
    <div>{badges.map(b => <div key={b.code}><Medal code={b.code} /><span>{badgeLabel(b.code, language)}</span></div>)}</div>
  </section>
}

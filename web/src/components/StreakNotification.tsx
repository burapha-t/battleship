import { useTranslation } from '../i18n/useTranslation'
// The "Hot streak ×N" badge and the levels card (#40, docs/frontend/7_hot_streak).
// Started from feat/extra-features-ui's StreakNotification.tsx. The count
// comes from my own `fireResult`s (streak.ts); the server sends nothing extra.

import { useEffect, useState } from 'react'
import type { Shot } from '../state/gameReducer'
import { STREAK_MIN, consecutiveHits } from '../rules/streak'

/** How long the badge stays up after each hit of a streak. */
export const STREAK_BADGE_MS = 2500

/** My streak after my latest shot. Only I see it: `myShots` are my shots alone. */
export function StreakNotification({ myShots, myId }: { myShots: Shot[]; myId: string | null }) {
  const count = consecutiveHits(myShots, myId)
  if (count < STREAK_MIN) return null
  // A new key per shot of mine restarts the timer and the pop-in.
  return <TimedBadge key={myShots.length} count={count} />
}

function TimedBadge({ count }: { count: number }) {
  const { t } = useTranslation('game')
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setHidden(true), STREAK_BADGE_MS)
    return () => clearTimeout(timer)
  }, [])
  if (hidden) return null

  // ×2 is a plain sticker, ×3 adds the flame, 4 or more is coral.
  const level = count >= 4 ? 'x4' : count === 3 ? 'x3' : 'x2'
  return (
    <div className={`streak-badge ${level}`} role="status">
      {level !== 'x2' && <Flame />}
      <div>
        <b>{t('hotStreakCount', { count })}</b>
        <span>{t('hitsInRow', { count })}</span>
      </div>
    </div>
  )
}

function Flame() {
  return (
    <svg viewBox="0 0 40 48" aria-hidden>
      <path
        d="M20 3c3 9 14 13 14 27a14 14 0 0 1-28 0c0-7 4-11 7-14 0 5 2 8 5 9-1-9 0-15 2-22z"
        fill="#FF4F5E"
        stroke="#14325A"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M20 24c2 4 7 6 7 12a7 7 0 0 1-14 0c0-4 3-6 4-8 1 3 2 4 3 4 0-3-1-5 0-8z"
        fill="#FFC83D"
        stroke="#14325A"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** The rules card for the centre column. */
export function StreakLevels() {
  const { t } = useTranslation('game')
  return (
    <div className="card levels">
      <h4>{t('hotStreak')}</h4>
      <p>{t('streakHint')}</p>
      <div className="lv">
        {t('hitsInRow', { count: 2 })}<span className="mult x2">×2</span>
      </div>
      <div className="lv">
        {t('hitsInRow', { count: 3 })}
        <span className="mult x3">
          <Flame />×3
        </span>
      </div>
      <div className="lv">
        {t('fourOrMore')}
        <span className="mult x4">
          <Flame />×4+
        </span>
      </div>
    </div>
  )
}

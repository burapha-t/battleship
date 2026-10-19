// The "Hot streak ×N" pop-up and the levels card (7_hot_streak). Display
// only: the count comes from the server's `streakUpdate`, never from the shots.

import { useEffect, useState } from 'react'
import type { Streak } from '../gameReducer'

/** How long the pop-up stays up after each `streakUpdate`. */
export const STREAK_POPUP_MS = 2500

/** ×2 is a plain sticker, ×3 adds the flame, 4 or more is coral. */
function level(count: number): 'x2' | 'x3' | 'x4' {
  return count >= 4 ? 'x4' : count === 3 ? 'x3' : 'x2'
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

const BURST =
  '196.0,100.0 159.9,116.0 183.1,148.0 143.8,143.8 148.0,183.1 116.0,159.9 100.0,196.0 84.0,159.9 52.0,183.1 ' +
  '56.2,143.8 16.9,148.0 40.1,116.0 4.0,100.0 40.1,84.0 16.9,52.0 56.2,56.2 52.0,16.9 84.0,40.1 100.0,4.0 ' +
  '116.0,40.1 148.0,16.9 143.8,56.2 183.1,52.0 159.9,84.0'

/**
 * Shows `streak` for STREAK_POPUP_MS, then hides it until the next one. Goes
 * inside the target `Board`, over the `half` that doesn't hold the newest hit.
 */
export function HotStreak({ streak, half }: { streak: Streak | null; half: 'top' | 'bottom' }) {
  const [expired, setExpired] = useState<Streak | null>(null)

  useEffect(() => {
    if (!streak) return
    const timer = setTimeout(() => setExpired(streak), STREAK_POPUP_MS)
    return () => clearTimeout(timer)
  }, [streak])

  if (!streak || streak === expired) return null
  const lv = level(streak.count)
  return (
    <div
      // A new key per event restarts the pop-in animation.
      key={`${streak.count}-${half}`}
      className={`streak ${half}`}
      role="status"
    >
      <svg className="burst" viewBox="0 0 200 200" aria-hidden>
        <polygon points={BURST} fill="#fff" stroke="#14325A" strokeWidth="4" strokeLinejoin="round" />
      </svg>
      <div className={`sticker ${lv}`}>
        {lv !== 'x2' && <Flame />}
        <div>
          <b>Hot streak ×{streak.count}</b>
          <span>{streak.count} hits in a row</span>
        </div>
      </div>
    </div>
  )
}

/** The rules card for the centre column. */
export function StreakLevels() {
  return (
    <div className="card levels">
      <h4>Hot streak</h4>
      <p>Hit twice in a row to start a streak. A miss or timeout resets it.</p>
      <div className="lv">
        2 hits in a row<span className="mult x2">×2</span>
      </div>
      <div className="lv">
        3 hits in a row
        <span className="mult x3">
          <Flame />×3
        </span>
      </div>
      <div className="lv">
        4 or more
        <span className="mult x4">
          <Flame />×4+
        </span>
      </div>
    </div>
  )
}

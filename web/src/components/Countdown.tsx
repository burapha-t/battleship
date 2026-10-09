import { useEffect, useState } from 'react'

/**
 * Counts `seconds` → 0 and restarts whenever `turnNumber` changes. Display
 * only: the server's timer is authoritative, so nothing happens at 0.
 */
export function Countdown({ seconds, turnNumber }: { seconds: number; turnNumber: number }) {
  const total = seconds * 1000
  const [tick, setTick] = useState({ turnNumber, leftMs: total })

  useEffect(() => {
    const start = Date.now()
    const timer = setInterval(() => {
      const leftMs = Math.max(0, total - (Date.now() - start))
      setTick({ turnNumber, leftMs })
      if (leftMs === 0) clearInterval(timer)
    }, 100)
    return () => clearInterval(timer)
  }, [total, turnNumber])

  const leftMs = tick.turnNumber === turnNumber ? tick.leftMs : total
  const left = Math.ceil(leftMs / 1000)
  const filled = total > 0 ? (leftMs / total) * 100 : 0

  return (
    <div
      className={`timer${left <= 3 ? ' urgent' : ''}`}
      style={{ background: `conic-gradient(var(--coral) 0 ${filled}%, #fff ${filled}% 100%)` }}
      role="timer"
      aria-label={`${left} seconds left`}
    >
      <div>
        <span>time left</span>
        <b key={left}>{left}</b>
        <span>seconds</span>
      </div>
    </div>
  )
}

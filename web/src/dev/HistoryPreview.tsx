// Dev page at ?preview=history: the match history screen with sample matches,
// since nothing is saved until login exists. ?preview=history-empty shows a
// new player, ?preview=history-loading the first load. No server needed.

import { useState } from 'react'
import type { HistoryView } from '../gameReducer'
import type { HistoryMatch } from '../protocol'
import { HistoryScreen } from '../screens/HistoryScreen'

const OPPONENTS = ['Bob', 'Chloe', 'Dan', 'Ploy', 'Ken']

// 26 matches, one every 40 minutes back from now, so "Show older matches" has a second page.
function sample(count: number): HistoryMatch[] {
  return Array.from({ length: count }, (_, i) => {
    const won = (i * 7) % 3 !== 0
    return {
      won,
      opponent: OPPONENTS[(i * 3) % OPPONENTS.length],
      endedAt: new Date(Date.now() - (i + 1) * 40 * 60_000).toISOString().replace(/\.\d+Z$/, 'Z'),
      accuracy: Math.round((won ? 48 + ((i * 13) % 30) : 22 + ((i * 11) % 20)) * 10) / 10,
    }
  })
}

const ALL = sample(26)
const wins = ALL.filter((m) => m.won).length
const STATS = {
  matchCount: ALL.length,
  winCount: wins,
  loseCount: ALL.length - wins,
  winRate: Math.round((1000 * wins) / ALL.length) / 10,
  accuracy: 47.3,
}

export function HistoryPreview({ mode }: { mode: string }) {
  const [view, setView] = useState<HistoryView | null>(() =>
    mode === 'history-loading'
      ? null
      : mode === 'history-empty'
        ? { stats: { matchCount: 0, winCount: 0, loseCount: 0, winRate: 0, accuracy: 0 }, matches: [], page: 1, more: false, loadingMore: false }
        : { stats: STATS, matches: ALL.slice(0, 20), page: 1, more: true, loadingMore: false },
  )

  const loadMore = () => {
    if (!view) return
    setView({ ...view, loadingMore: true })
    setTimeout(() => setView({ ...view, matches: ALL, page: 2, more: false, loadingMore: false }), 600)
  }

  return (
    <div className="app">
      <svg className="waves" viewBox="0 0 1280 110" preserveAspectRatio="none" aria-hidden>
        <path d="M0 40 Q 80 10 160 40 T 320 40 T 480 40 T 640 40 T 800 40 T 960 40 T 1120 40 T 1280 40 V110 H0Z" fill="#9CCDF3" />
        <path d="M0 68 Q 80 42 160 68 T 320 68 T 480 68 T 640 68 T 800 68 T 960 68 T 1120 68 T 1280 68 V110 H0Z" fill="#2F8FE0" stroke="#14325A" strokeWidth="3" />
      </svg>
      <header className="header">
        <div className="logo"><b>Battle</b>ship</div>
      </header>
      <HistoryScreen history={view} failed={false} onBack={() => console.info('[preview] back')} onLoadMore={loadMore} onRetry={() => {}} />
    </div>
  )
}

// Dev page at ?preview=leaderboard: the leaderboard screen with the mockup's
// players (docs/frontend/8_leaderboard.html), since nothing is saved until
// login exists. Alice is me. ?preview=leaderboard-empty shows no ranked
// players, ?preview=leaderboard-loading the load. No server needed.

import type { LeaderboardRow } from '../protocol'
import { LeaderboardScreen } from '../screens/LeaderboardScreen'

const ROWS: LeaderboardRow[] = [
  { rank: 1, name: 'Mira', points: 11, accuracy: 62.5 },
  { rank: 2, name: 'Bob', points: 9, accuracy: 55.1 },
  { rank: 3, name: 'Alice', points: 8, accuracy: 48.7 },
  { rank: 4, name: 'Ken', points: 7, accuracy: 51.2 },
  { rank: 5, name: 'Chloe', points: 6, accuracy: 44 },
  { rank: 6, name: 'Ploy', points: 5, accuracy: 47.9 },
  { rank: 7, name: 'Dan', points: 4, accuracy: 39.3 },
  { rank: 8, name: 'Tom', points: 3, accuracy: 41.6 },
  { rank: 9, name: 'Nina', points: 2, accuracy: 35 },
  { rank: 10, name: 'Sam', points: 1, accuracy: 28.4 },
]

export function LeaderboardPreview({ mode }: { mode: string }) {
  const rows = mode === 'leaderboard-loading' ? null : mode === 'leaderboard-empty' ? [] : ROWS
  return (
    <div className="app">
      <svg className="waves" viewBox="0 0 1280 110" preserveAspectRatio="none" aria-hidden>
        <path d="M0 40 Q 80 10 160 40 T 320 40 T 480 40 T 640 40 T 800 40 T 960 40 T 1120 40 T 1280 40 V110 H0Z" fill="#9CCDF3" />
        <path d="M0 68 Q 80 42 160 68 T 320 68 T 480 68 T 640 68 T 800 68 T 960 68 T 1120 68 T 1280 68 V110 H0Z" fill="#2F8FE0" stroke="#14325A" strokeWidth="3" />
      </svg>
      <header className="header">
        <div className="logo"><b>Battle</b>ship</div>
      </header>
      <LeaderboardScreen rows={rows} failed={false} myName="Alice" onHome={() => console.info('[preview] home')} onRetry={() => {}} />
    </div>
  )
}

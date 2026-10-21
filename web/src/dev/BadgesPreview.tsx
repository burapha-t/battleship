// Dev page at ?preview=badges: the badges screen with sample badges, since
// nothing is saved until login exists. ?preview=badges-empty shows a new
// player, ?preview=badges-loading the load, and ?preview=badges-unlock the end
// screen with the new-badge card. No server needed.

import { initialState } from '../gameReducer'
import type { GameState } from '../gameReducer'
import type { AchievementsView, BadgeUnlock } from '../protocol'
import { BadgesScreen } from '../screens/BadgesScreen'
import { EndScreen } from '../screens/EndScreen'

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().replace(/\.\d+Z$/, 'Z')

// 12 wins, a best match of 64.3% and a best run of 7: two or three badges in each group.
const SAMPLE: AchievementsView = {
  wins: 12,
  bestAccuracy: 64.3,
  bestStreak: 7,
  badges: [
    { code: 'accuracy-40', unlockedAt: daysAgo(9) },
    { code: 'streak-4', unlockedAt: daysAgo(9) },
    { code: 'wins-5', unlockedAt: daysAgo(6) },
    { code: 'accuracy-50', unlockedAt: daysAgo(4) },
    { code: 'accuracy-60', unlockedAt: daysAgo(4) },
    { code: 'streak-6', unlockedAt: daysAgo(4) },
    { code: 'wins-10', unlockedAt: daysAgo(1) },
  ],
}

const EMPTY: AchievementsView = { wins: 0, bestAccuracy: 0, bestStreak: 0, badges: [] }

// What one match could have just earned Alice.
const UNLOCKED: BadgeUnlock[] = [
  { code: 'wins-10', unlockedAt: daysAgo(0) },
  { code: 'accuracy-60', unlockedAt: daysAgo(0) },
  { code: 'streak-6', unlockedAt: daysAgo(0) },
]

const END: GameState = {
  ...initialState,
  screen: 'end',
  myId: 'p1',
  myName: 'Alice',
  myScore: 3,
  players: [
    { id: 'p1', name: 'Alice', score: 3 },
    { id: 'p2', name: 'Bob', score: 1 },
  ],
  winnerId: 'p1',
  matchId: 'm4',
  unlocked: UNLOCKED,
}

export function BadgesPreview({ mode }: { mode: string }) {
  return (
    <div className="app">
      <svg className="waves" viewBox="0 0 1280 110" preserveAspectRatio="none" aria-hidden>
        <path d="M0 40 Q 80 10 160 40 T 320 40 T 480 40 T 640 40 T 800 40 T 960 40 T 1120 40 T 1280 40 V110 H0Z" fill="#9CCDF3" />
        <path d="M0 68 Q 80 42 160 68 T 320 68 T 480 68 T 640 68 T 800 68 T 960 68 T 1120 68 T 1280 68 V110 H0Z" fill="#2F8FE0" stroke="#14325A" strokeWidth="3" />
      </svg>
      <header className="header">
        <div className="logo"><b>Battle</b>ship</div>
      </header>
      {mode === 'badges-unlock' ? (
        <EndScreen state={END} onRematch={() => console.info('[preview] rematch')} onHome={() => console.info('[preview] home')} />
      ) : (
        <BadgesScreen
          achievements={mode === 'badges-loading' ? null : mode === 'badges-empty' ? EMPTY : SAMPLE}
          failed={false}
          onBack={() => console.info('[preview] back')}
          onRetry={() => {}}
        />
      )}
    </div>
  )
}

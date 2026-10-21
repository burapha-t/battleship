// Dev page at ?preview=profile: the profile screen with the mockup's Alice
// (docs/frontend/9_profile.html), since nothing is saved until login exists.
// Save works locally, the way the server would answer. ?preview=profile-guest
// shows a guest, ?preview=profile-empty a new account, ?preview=profile-loading
// the load. No server needed.

import { useState } from 'react'
import type { AchievementsView, ProfileView } from '../protocol'
import { ProfileScreen } from '../screens/ProfileScreen'

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().replace(/\.\d+Z$/, 'Z')

const SAMPLE: ProfileView = {
  guest: false,
  avatar: 'pufferfish',
  shownBadges: ['wins-5', 'accuracy-70', 'streak-6'],
  rank: 3,
  wins: 8,
}

// 8 wins, a best match of 73% and a best run of 6, as in the mockup.
const SAMPLE_BADGES: AchievementsView = {
  wins: 8,
  bestAccuracy: 73,
  bestStreak: 6,
  badges: [
    { code: 'accuracy-40', unlockedAt: daysAgo(9) },
    { code: 'streak-4', unlockedAt: daysAgo(9) },
    { code: 'wins-5', unlockedAt: daysAgo(6) },
    { code: 'accuracy-50', unlockedAt: daysAgo(4) },
    { code: 'accuracy-60', unlockedAt: daysAgo(4) },
    { code: 'accuracy-70', unlockedAt: daysAgo(2) },
    { code: 'streak-6', unlockedAt: daysAgo(2) },
  ],
}

const EMPTY: ProfileView = { guest: false, avatar: '', shownBadges: [], rank: null, wins: 0 }
const NO_BADGES: AchievementsView = { wins: 0, bestAccuracy: 0, bestStreak: 0, badges: [] }

export function ProfilePreview({ mode }: { mode: string }) {
  const [profile, setProfile] = useState<ProfileView | null>(
    mode === 'profile-loading' ? null : mode === 'profile-guest' ? { ...EMPTY, guest: true } : mode === 'profile-empty' ? EMPTY : SAMPLE,
  )
  const achievements = mode === 'profile-loading' ? null : mode === 'profile' ? SAMPLE_BADGES : NO_BADGES

  return (
    <div className="app">
      <svg className="waves" viewBox="0 0 1280 110" preserveAspectRatio="none" aria-hidden>
        <path d="M0 40 Q 80 10 160 40 T 320 40 T 480 40 T 640 40 T 800 40 T 960 40 T 1120 40 T 1280 40 V110 H0Z" fill="#9CCDF3" />
        <path d="M0 68 Q 80 42 160 68 T 320 68 T 480 68 T 640 68 T 800 68 T 960 68 T 1120 68 T 1280 68 V110 H0Z" fill="#2F8FE0" stroke="#14325A" strokeWidth="3" />
      </svg>
      <header className="header">
        <div className="logo"><b>Battle</b>ship</div>
      </header>
      <ProfileScreen
        profile={profile}
        achievements={achievements}
        failed={false}
        saving={false}
        myName="Alice"
        onHome={() => console.info('[preview] home')}
        onRetry={() => {}}
        onSave={(avatar, shownBadges) => {
          console.info('[preview] profileUpdate', { avatar, shownBadges })
          setProfile((saved) => saved && { ...saved, avatar, shownBadges })
        }}
      />
    </div>
  )
}

// English and Thai text for the leaderboard screen, picked the way the match
// history screen picks it (historyLanguage). Swap for the redesign's t() once
// feat/extra-features-ui merges.

import type { Language } from './historyText'

const TEXT = {
  title: ['Leaderboard', 'กระดานผู้นำ'],
  subtitle: ['Ranked by total wins', 'จัดอันดับตามจำนวนชัยชนะ'],
  home: ['Home', 'หน้าหลัก'],
  you: ['You', 'คุณ'],
  rank: ['Rank', 'อันดับ'],
  name: ['Name', 'ชื่อ'],
  point: ['Point', 'คะแนน'],
  accuracy: ['Accuracy', 'ความแม่นยำ'],
  loading: ['Loading the leaderboard…', 'กำลังโหลดกระดานผู้นำ…'],
  emptyTitle: ['No ranked players yet', 'ยังไม่มีผู้เล่นที่ได้รับการจัดอันดับ'],
  emptyBody: [
    'Finish a match while you are logged in to get on the board.',
    'เล่นแมตช์ให้จบขณะเข้าสู่ระบบเพื่อขึ้นกระดาน',
  ],
  failed: ["The leaderboard couldn't be loaded.", 'โหลดกระดานผู้นำไม่สำเร็จ'],
  retry: ['Try again', 'ลองอีกครั้ง'],
} satisfies Record<string, [en: string, th: string]>

export type LeaderboardTextKey = keyof typeof TEXT

export function leaderboardText(language: Language): (key: LeaderboardTextKey) => string {
  return (key) => TEXT[key][language === 'th' ? 1 : 0]
}

/** 11 → "11 wins", 1 → "1 win"; Thai "ชนะ 11 ครั้ง". */
export function wins(points: number, language: Language): string {
  if (language === 'th') return `ชนะ ${points} ครั้ง`
  return points === 1 ? '1 win' : `${points} wins`
}

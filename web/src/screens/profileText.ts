// English and Thai text for the profile screen (#42). The screen passes in the
// language from the device settings (#43). Badge names are in badgesText.ts.

import type { BadgeGroup } from '../badges'
import type { AchievementsView } from '../protocol'
import { percent } from './historyText'
import type { Language } from './historyText'
import { wins } from './leaderboardText'

/** The 8 pictures, in the mockup's order; the server accepts these codes and '' for none. */
export const AVATARS = ['whale', 'octopus', 'crab', 'pufferfish', 'turtle', 'jellyfish', 'starfish', 'shark'] as const

const TEXT = {
  title: ['Profile', 'โปรไฟล์'],
  subtitle: ['How other captains see you', 'กัปตันคนอื่นเห็นคุณแบบนี้'],
  home: ['Home', 'หน้าหลัก'],
  onShow: ['Badges on show', 'เหรียญตราที่แสดง'],
  noneShown: ['No badges on show. Pick up to 3 you have earned.', 'ยังไม่ได้เลือกเหรียญตรา เลือกได้สูงสุด 3 เหรียญที่ได้รับแล้ว'],
  save: ['Save profile', 'บันทึกโปรไฟล์'],
  saving: ['Saving…', 'กำลังบันทึก…'],
  guest: ['Log in to save your picture and badges.', 'เข้าสู่ระบบเพื่อบันทึกรูปและเหรียญตรา'],
  pictures: ['Choose your profile picture', 'เลือกรูปโปรไฟล์'],
  badges: ['Choose up to 3 badges to show', 'เลือกเหรียญตราที่จะแสดง (สูงสุด 3 เหรียญ)'],
  locked: ['Locked', 'ยังไม่ได้รับ'],
  loading: ['Loading your profile…', 'กำลังโหลดโปรไฟล์ของคุณ…'],
  failed: ["Your profile couldn't be loaded.", 'โหลดโปรไฟล์ไม่สำเร็จ'],
  retry: ['Try again', 'ลองอีกครั้ง'],
  whale: ['Whale', 'วาฬ'],
  octopus: ['Octopus', 'หมึกยักษ์'],
  crab: ['Crab', 'ปู'],
  pufferfish: ['Pufferfish', 'ปลาปักเป้า'],
  turtle: ['Turtle', 'เต่า'],
  jellyfish: ['Jellyfish', 'แมงกะพรุน'],
  starfish: ['Starfish', 'ปลาดาว'],
  shark: ['Shark', 'ฉลาม'],
} satisfies Record<string, [en: string, th: string]>

export type ProfileTextKey = keyof typeof TEXT

export function profileText(language: Language): (key: ProfileTextKey) => string {
  return (key) => TEXT[key][language === 'th' ? 1 : 0]
}

/** "Rank 3 · 8 wins", or "Not ranked yet · 0 wins" with no saved match. */
export function rankLine(rank: number | null, winCount: number, language: Language): string {
  const th = language === 'th'
  const place = rank === null ? (th ? 'ยังไม่มีอันดับ' : 'Not ranked yet') : th ? `อันดับ ${rank}` : `Rank ${rank}`
  return `${place} · ${wins(winCount, language)}`
}

/** "2 of 3 chosen". */
export function chosenText(count: number, language: Language): string {
  return language === 'th' ? `เลือกแล้ว ${count} จาก 3` : `${count} of 3 chosen`
}

/** Under each row of badges: "Best: 8 wins", "Best match: 73.0%", "Best: 6 in a row". */
export function bestText(group: BadgeGroup, view: AchievementsView, language: Language): string {
  const th = language === 'th'
  switch (group) {
    case 'wins':
      return `${th ? 'สูงสุด' : 'Best'}: ${wins(view.wins, language)}`
    case 'accuracy':
      return `${th ? 'แมตช์ที่ดีที่สุด' : 'Best match'}: ${percent(view.bestAccuracy, language)}`
    case 'streak':
      return th ? `สูงสุด: ติดกัน ${view.bestStreak} ครั้ง` : `Best: ${view.bestStreak} in a row`
  }
}

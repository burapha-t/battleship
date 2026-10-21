// English and Thai text for the badges screen and the end screen's unlock card
// (#41). The screen passes in the language from the device settings (#43).

import type { BadgeGroup, GroupProgress } from '../badges'
import { percent } from './historyText'
import type { Language } from './historyText'

const TEXT = {
  title: ['Badges', 'เหรียญตรา'],
  subtitle: ['Earn them in battle', 'สะสมได้จากการรบ'],
  home: ['Home', 'หน้าหลัก'],
  wins: ['Win count', 'จำนวนชัยชนะ'],
  accuracy: ['Accuracy', 'ความแม่นยำ'],
  streak: ['Hit streak', 'ยิงโดนต่อเนื่อง'],
  winsHint: ['Total wins over all your matches', 'ชัยชนะทั้งหมดจากทุกแมตช์'],
  accuracyHint: ['Your best accuracy in one match', 'ความแม่นยำสูงสุดในแมตช์เดียว'],
  streakHint: ['Most hits in a row in one match', 'ยิงโดนติดกันมากที่สุดในแมตช์เดียว'],
  locked: ['Locked', 'ยังไม่ได้รับ'],
  allEarned: ['All five earned!', 'ได้ครบทั้งห้าเหรียญแล้ว!'],
  loading: ['Loading your badges…', 'กำลังโหลดเหรียญตราของคุณ…'],
  empty: [
    'No badges yet. Finish a match while you are logged in to start earning them.',
    'ยังไม่มีเหรียญตรา เล่นแมตช์ให้จบขณะเข้าสู่ระบบเพื่อเริ่มสะสม',
  ],
  failed: ["Your badges couldn't be loaded.", 'โหลดเหรียญตราไม่สำเร็จ'],
  retry: ['Try again', 'ลองอีกครั้ง'],
  newBadge: ['New badge!', 'ได้เหรียญตราใหม่!'],
  newBadges: ['New badges!', 'ได้เหรียญตราใหม่!'],
} satisfies Record<string, [en: string, th: string]>

export type BadgesTextKey = keyof typeof TEXT

export function badgesText(language: Language): (key: BadgesTextKey) => string {
  return (key) => TEXT[key][language === 'th' ? 1 : 0]
}

/** "wins-10" → "10 wins", "accuracy-40" → "Over 40%", "streak-6" → "6 in a row". */
export function badgeLabel(code: string, language: Language): string {
  const [group, tier] = code.split('-')
  const th = language === 'th'
  switch (group as BadgeGroup) {
    case 'wins':
      return th ? `ชนะ ${tier} ครั้ง` : `${tier} wins`
    case 'accuracy':
      return th ? `มากกว่า ${tier}%` : `Over ${tier}%`
    case 'streak':
      return th ? `ยิงโดนติดกัน ${tier} ครั้ง` : `${tier} in a row`
    default:
      return code
  }
}

/** "3 of 5 earned". */
export function earnedText(earned: number, language: Language): string {
  return language === 'th' ? `ได้แล้ว ${earned} จาก 5` : `${earned} of 5 earned`
}

/** My stat in a group: "12 wins", "Best 64.3%", "Best 7 in a row". */
export function statText({ group, value }: GroupProgress, language: Language): string {
  const th = language === 'th'
  switch (group) {
    case 'wins':
      return th ? `ชนะ ${value} ครั้ง` : value === 1 ? '1 win' : `${value} wins`
    case 'accuracy':
      return th ? `ดีที่สุด ${percent(value, language)}` : `Best ${percent(value, language)}`
    case 'streak':
      return th ? `ดีที่สุด ${value} ครั้งติดกัน` : `Best ${value} in a row`
  }
}

/** "Next: 20 wins", or the all-earned line. */
export function nextText({ next }: GroupProgress, language: Language): string {
  if (!next) return badgesText(language)('allEarned')
  return `${language === 'th' ? 'ถัดไป' : 'Next'}: ${badgeLabel(next.code, language)}`
}

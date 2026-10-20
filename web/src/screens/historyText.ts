// English and Thai text for the match history screen. The screen passes in the
// language from the device settings (#43).

export type Language = 'en' | 'th'

const TEXT = {
  title: ['Match history', 'ประวัติการแข่งขัน'],
  back: ['Back to lobby', 'กลับไปล็อบบี้'],
  matches: ['Matches', 'แมตช์'],
  wins: ['Wins', 'ชนะ'],
  losses: ['Losses', 'แพ้'],
  winRate: ['Win rate', 'อัตราชนะ'],
  accuracy: ['Shot accuracy', 'ความแม่นยำ'],
  result: ['Result', 'ผล'],
  opponent: ['Opponent', 'คู่แข่ง'],
  when: ['Date and time', 'วันและเวลา'],
  matchAccuracy: ['Accuracy', 'ความแม่นยำ'],
  win: ['Win', 'ชนะ'],
  lost: ['Lost', 'แพ้'],
  loading: ['Loading your matches…', 'กำลังโหลดแมตช์ของคุณ…'],
  loadingMore: ['Loading…', 'กำลังโหลด…'],
  more: ['Show older matches', 'ดูแมตช์ก่อนหน้า'],
  emptyTitle: ['No saved matches yet', 'ยังไม่มีแมตช์ที่บันทึกไว้'],
  emptyBody: [
    'Finish a match while you are logged in and it shows up here.',
    'แมตช์ที่เล่นจบขณะเข้าสู่ระบบจะแสดงที่นี่',
  ],
  failed: ["Your match history couldn't be loaded.", 'โหลดประวัติการแข่งขันไม่สำเร็จ'],
  retry: ['Try again', 'ลองอีกครั้ง'],
} satisfies Record<string, [en: string, th: string]>

export type TextKey = keyof typeof TEXT

export function historyText(language: Language): (key: TextKey) => string {
  return (key) => TEXT[key][language === 'th' ? 1 : 0]
}

/** 66.7 → "66.7%", 50 → "50%". */
export function percent(value: number, language: Language): string {
  return `${new Intl.NumberFormat(locale(language), { maximumFractionDigits: 1 }).format(value)}%`
}

/** UTC ISO time → local "Oct 19, 14:31", with the year when it isn't this year. */
export function localTime(iso: string, language: Language, now = new Date()): string {
  const date = new Date(iso)
  return new Intl.DateTimeFormat(locale(language), {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
}

function locale(language: Language): string {
  return language === 'th' ? 'th-TH' : 'en-US'
}

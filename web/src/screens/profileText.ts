// Profile (#42) and badge unlock (#41) strings.
import type { Language } from '../settings'
const TEXT = {
  title: ['Profile', 'โปรไฟล์'], subtitle: ['How other captains see you', 'ตัวตนของคุณในสายตากัปตันคนอื่น'],
  home: ['Home', 'หน้าหลัก'], shelf: ['Badges on show', 'เหรียญตราที่แสดง'], save: ['Save profile', 'บันทึกโปรไฟล์'],
  saving: ['Saving…', 'กำลังบันทึก…'], guest: ['Log in to save', 'เข้าสู่ระบบเพื่อบันทึก'],
  guestHint: ['Play as a guest. Log in to save your picture and badges.', 'คุณกำลังเล่นเป็นผู้เยี่ยมชม เข้าสู่ระบบเพื่อบันทึกรูปและเหรียญตรา'],
  pictures: ['Choose your profile picture', 'เลือกรูปโปรไฟล์ของคุณ'], choose: ['Choose 3 badges to show', 'เลือกแสดงเหรียญตราได้ 3 เหรียญ'],
  empty: ['Earn badges by playing matches, then choose up to three to show.', 'เล่นแมตช์เพื่อรับเหรียญตรา แล้วเลือกแสดงได้สูงสุดสามเหรียญ'],
  loading: ['Loading your profile…', 'กำลังโหลดโปรไฟล์ของคุณ…'], failed: ["Your profile couldn't be loaded.", 'โหลดโปรไฟล์ไม่สำเร็จ'],
  retry: ['Try again', 'ลองอีกครั้ง'], locked: ['locked', 'ยังไม่ปลดล็อก'],
  wins: ['Win count', 'จำนวนชัยชนะ'], accuracy: ['Accuracy', 'ความแม่นยำ'], streak: ['Hit streak', 'ยิงโดนต่อเนื่อง'],
  best: ['Best:', 'สถิติสูงสุด:'], bestMatch: ['Best match:', 'แมตช์ที่แม่นที่สุด:'],
  chosen: ['of 3 chosen', 'จาก 3 เหรียญที่เลือก'], newBadge: ['New badge!', 'ปลดล็อกเหรียญตราใหม่!'],
  whale: ['Whale', 'วาฬ'], octopus: ['Octopus', 'หมึกยักษ์'], crab: ['Crab', 'ปู'], pufferfish: ['Pufferfish', 'ปลาปักเป้า'],
  turtle: ['Turtle', 'เต่า'], jellyfish: ['Jellyfish', 'แมงกะพรุน'], starfish: ['Starfish', 'ปลาดาว'], shark: ['Shark', 'ฉลาม'],
} satisfies Record<string, [string, string]>
export function profileText(language: Language) {
  return (key: keyof typeof TEXT) => TEXT[key][language === 'th' ? 1 : 0]
}
export const AVATAR_CODES = ['whale', 'octopus', 'crab', 'pufferfish', 'turtle', 'jellyfish', 'starfish', 'shark'] as const

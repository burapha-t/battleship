export const captains = [
  { name: 'CoralQueen', elo: 1924, wins: 124, losses: 38, color: 'var(--coral)' },
  { name: 'WaveRider', elo: 1856, wins: 112, losses: 42, color: 'var(--sea)' },
  { name: 'AdmiralMango', elo: 1782, wins: 98, losses: 37, color: 'var(--sun)' },
  { name: 'SeaBreeze', elo: 1640, wins: 86, losses: 44, color: 'var(--kelp)' },
  { name: 'Captain', elo: 1480, wins: 42, losses: 26, color: 'var(--lilac)' },
  { name: 'TinyTorpedo', elo: 1412, wins: 38, losses: 29, color: 'var(--peach)' },
  { name: 'BlueFin', elo: 1296, wins: 25, losses: 24, color: 'var(--foam)' },
]
export const matches = [
  { id: 'BS-1048', opponent: 'SeaBreeze', won: true, change: 24, elo: 1480, accuracy: 64, shots: 25, date: '2026-10-15T08:40:00+07:00', duration: '06:20', streak: 4 },
  { id: 'BS-1047', opponent: 'WaveRider', won: false, change: -16, elo: 1456, accuracy: 48, shots: 25, date: '2026-10-15T08:10:00+07:00', duration: '07:05', streak: 2 },
  { id: 'BS-1046', opponent: 'BlueFin', won: true, change: 18, elo: 1472, accuracy: 73, shots: 22, date: '2026-10-14T19:15:00+07:00', duration: '05:40', streak: 5 },
  { id: 'BS-1045', opponent: 'TinyTorpedo', won: true, change: 22, elo: 1454, accuracy: 59, shots: 27, date: '2026-10-14T18:30:00+07:00', duration: '06:55', streak: 3 },
  { id: 'BS-1044', opponent: 'CoralQueen', won: false, change: -12, elo: 1432, accuracy: 44, shots: 25, date: '2026-10-13T20:00:00+07:00', duration: '07:30', streak: 2 },
]
export const badges = [
  { icon: '⚓', en: 'First command', th: 'กัปตันมือใหม่', desc: 'Finish your first match', thai: 'เล่นจบแมตช์แรก', value: 1, goal: 1, color: 'var(--foam)' },
  { icon: '🏆', en: 'Victory at sea', th: 'ชัยชนะกลางทะเล', desc: 'Win 10 matches', thai: 'ชนะ 10 แมตช์', value: 10, goal: 10, color: 'var(--sun)' },
  { icon: '🔥', en: 'On fire', th: 'ร้อนแรง', desc: 'Land 3 hits in a row', thai: 'ยิงโดนติดต่อกัน 3 ครั้ง', value: 3, goal: 3, color: 'var(--peach)' },
  { icon: '🎯', en: 'Sharpshooter', th: 'มือแม่น', desc: 'Reach 70% accuracy in a match', thai: 'ยิงแม่น 70% ในหนึ่งแมตช์', value: 70, goal: 70, color: 'var(--kelp)' },
  { icon: '🚢', en: 'Fleet legend', th: 'ตำนานกองเรือ', desc: 'Win 100 matches', thai: 'ชนะ 100 แมตช์', value: 42, goal: 100, color: 'var(--lilac)' },
  { icon: '👑', en: 'Admiral', th: 'พลเรือเอก', desc: 'Reach 1,800 Elo', thai: 'มีคะแนน Elo ถึง 1,800', value: 1480, goal: 1800, color: 'var(--sun)' },
]
export function rank(elo: number): [string, string] { return elo >= 1800 ? ['Admiral', 'พลเรือเอก'] : elo >= 1500 ? ['Commander', 'ผู้บัญชาการ'] : elo >= 1200 ? ['Captain', 'กัปตัน'] : ['Cadet', 'นักเรียนนายเรือ'] }

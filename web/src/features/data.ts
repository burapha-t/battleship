export const captains = [
  { name: 'Mira', wins: 11, color: 'var(--sea)' },
  { name: 'Bob', wins: 9, color: 'var(--lilac)' },
  { name: 'Alice', wins: 8, color: 'var(--sun)' },
  { name: 'Ken', wins: 7, color: 'var(--lilac)' },
  { name: 'Chloe', wins: 6, color: 'var(--peach)' },
  { name: 'Ploy', wins: 5, color: 'var(--peach)' },
  { name: 'Dan', wins: 4, color: 'var(--kelp)' },
  { name: 'Tom', wins: 3, color: 'var(--kelp)' },
  { name: 'Nina', wins: 2, color: 'var(--paper)' },
  { name: 'Sam', wins: 1, color: 'var(--paper)' },
]
export const matches = [
  { opponent: 'Bob', won: true, score: '2–1', hits: 16, shots: 28, date: '2026-10-09T12:31:00+07:00', color: 'var(--lilac)' },
  { opponent: 'Bob', won: true, score: '1–1', hits: 16, shots: 34, date: '2026-10-09T12:18:00+07:00', color: 'var(--lilac)' },
  { opponent: 'Bob', won: false, score: '0–1', hits: 12, shots: 30, date: '2026-10-09T12:07:00+07:00', color: 'var(--lilac)' },
  { opponent: 'Chloe', won: true, score: '3–1', hits: 16, shots: 25, date: '2026-10-08T19:42:00+07:00', color: 'var(--peach)' },
  { opponent: 'Chloe', won: true, score: '2–1', hits: 16, shots: 31, date: '2026-10-08T19:30:00+07:00', color: 'var(--peach)' },
  { opponent: 'Chloe', won: false, score: '1–1', hits: 13, shots: 33, date: '2026-10-08T19:15:00+07:00', color: 'var(--peach)' },
  { opponent: 'Chloe', won: true, score: '1–0', hits: 16, shots: 29, date: '2026-10-08T19:02:00+07:00', color: 'var(--peach)' },
  { opponent: 'Dan', won: true, score: '2–0', hits: 16, shots: 22, date: '2026-10-07T21:10:00+07:00', color: 'var(--kelp)' },
  { opponent: 'Dan', won: true, score: '1–0', hits: 16, shots: 27, date: '2026-10-07T20:58:00+07:00', color: 'var(--kelp)' },
  { opponent: 'Bob', won: false, score: '1–2', hits: 14, shots: 35, date: '2026-10-06T18:44:00+07:00', color: 'var(--lilac)' },
  { opponent: 'Bob', won: true, score: '1–1', hits: 16, shots: 30, date: '2026-10-06T18:30:00+07:00', color: 'var(--lilac)' },
  { opponent: 'Bob', won: false, score: '0–1', hits: 11, shots: 32, date: '2026-10-06T18:17:00+07:00', color: 'var(--lilac)' },
]
export const avatarOptions = [
  ['whale', 'Whale', 'วาฬ'], ['octopus', 'Octopus', 'หมึก'], ['crab', 'Crab', 'ปู'], ['pufferfish', 'Pufferfish', 'ปลาปักเป้า'],
  ['turtle', 'Turtle', 'เต่า'], ['jellyfish', 'Jellyfish', 'แมงกะพรุน'], ['starfish', 'Starfish', 'ดาวทะเล'], ['shark', 'Shark', 'ฉลาม'],
]
export const badgeGroups = [
  { id: 'wins', en: 'Win count', th: 'จำนวนชัยชนะ', best: 8, values: [5, 10, 20, 50, 100], colors: ['#FFF1C2', '#FFE08A', '#FFC83D', '#F2A81D', '#D98A0B'], icon: 'trophy' as const },
  { id: 'accuracy', en: 'Accuracy', th: 'ความแม่นยำ', best: 73, values: [40, 50, 60, 70, 80], colors: ['#CFE8FB', '#9CCDF3', '#5AAEEB', '#2F8FE0', '#1E6FBF'], icon: 'target' as const },
  { id: 'streak', en: 'Hit streak', th: 'ยิงโดนต่อเนื่อง', best: 6, values: [4, 6, 8, 10, 12], colors: ['#FFD3CF', '#FFA9A3', '#FF7A70', '#FF4F5E', '#D9283A'], icon: 'fire' as const },
]

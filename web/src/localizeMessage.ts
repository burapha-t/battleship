// Localize known server messages at the display boundary, without changing the protocol.
export function localizeMessage(message: string, language: string): string {
  if (language !== 'th') return message
  const known: Record<string, string> = {
    'It is not your turn.': 'ยังไม่ถึงตาของคุณ',
    'You already fired at that cell.': 'คุณยิงช่องนี้ไปแล้ว',
    'You are not in a match.': 'คุณไม่ได้อยู่ในแมตช์',
    "The match isn't in play.": 'แมตช์ยังไม่เริ่มหรือจบแล้ว',
    "You can't place ships now.": 'ไม่สามารถวางเรือในขณะนี้',
    "There's no finished match to rematch.": 'ยังไม่มีแมตช์ที่จบแล้วให้แข่งใหม่',
    'You can only look for a match from the lobby.': 'ค้นหาแมตช์ได้จากล็อบบี้เท่านั้น',
    'You have already joined.': 'คุณเข้าร่วมแล้ว',
    'The server was reset': 'เซิร์ฟเวอร์ถูกรีเซ็ต',
  }
  if (known[message]) return known[message]
  return message
    .replace(/^Nickname must be 1-(\d+) characters\.$/, 'ชื่อเล่นต้องมีความยาว 1–$1 ตัวอักษร')
    .replace(/^Place exactly (\d+) ships\.$/, 'วางเรือให้ครบ $1 ลำ')
    .replace(/^Ship (\d+) must cover exactly (\d+) cells\.$/, 'เรือลำที่ $1 ต้องยาว $2 ช่อง')
    .replace(/^Ship (\d+) is off the grid\.$/, 'เรือลำที่ $1 อยู่นอกกระดาน')
    .replace(/^Ship (\d+) uses a cell that is already taken\.$/, 'เรือลำที่ $1 ซ้อนทับช่องที่มีเรือแล้ว')
    .replace(/^Ship (\d+) is not in a straight line\.$/, 'เรือลำที่ $1 ต้องวางเป็นเส้นตรง')
    .replace(/^Ship (\d+) has a gap between its cells\.$/, 'เรือลำที่ $1 ต้องไม่มีช่องว่างระหว่างลำ')
    .replace(/^Row and column must be 0-(\d+)\.$/, 'แถวและคอลัมน์ต้องอยู่ระหว่าง 0–$1')
    .replace(/^This page speaks protocol v(\d+), but the server speaks v(\d+)\.$/, 'หน้านี้ใช้โปรโตคอลรุ่น $1 แต่เซิร์ฟเวอร์ใช้รุ่น $2')
    .replace(/ left the game$/, ' ออกจากเกมแล้ว')
}

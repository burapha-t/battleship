import { useEffect, useState } from 'react'
import type { GameState } from '../gameReducer'
import { usePreferences } from '../preferences'
import { consecutiveHits } from './streak'

export function StreakNotification({ state, preview }: { state: GameState; preview: number }) {
  const { streaks } = usePreferences()
  const ownShots = state.shots.filter(shot => shot.by === state.myId)
  const count = consecutiveHits(ownShots, state.myId)
  const sample = preview > 0
  if (!streaks || (!sample && (state.screen !== 'game' || count < 3))) return null
  return <TimedNotification key={sample ? `preview-${preview}` : `live-${ownShots.length}`} count={sample ? 3 : count} sample={sample} />
}
function TimedNotification({ count, sample }: { count: number; sample: boolean }) {
  const { t } = usePreferences()
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setHidden(true), 3500)
    return () => clearTimeout(timer)
  }, [])
  if (hidden) return null
  return <div className="streak-toast" role="status" aria-live="polite"><span aria-hidden>🔥</span><div><strong>{t(`${count} hits in a row!`, `ยิงโดนต่อเนื่อง ${count} ครั้ง!`)}</strong><small>{sample ? t('Preview · Hit streak notification', 'ตัวอย่าง · การแจ้งเตือนยิงโดนต่อเนื่อง') : t('On fire, captain. Keep it going!', 'ร้อนแรงมาก กัปตัน ลุยต่อเลย!')}</small></div><button type="button" aria-label={t('Dismiss', 'ปิด')} onClick={() => setHidden(true)}>✕</button></div>
}

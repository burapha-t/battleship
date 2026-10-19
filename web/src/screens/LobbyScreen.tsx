import { usePreferences } from '../preferences'
import { useState } from 'react'
import { Avatar } from '../components/Avatar'
import { Hero } from '../components/Hero'
import type { GameState } from '../gameReducer'
import type { LobbyClient, LobbyStatus } from '../protocol'
import './screens.css'

const STATUS: Record<LobbyStatus, { label: string; dot: string }> = {
  connecting: { label: 'Connecting…', dot: 'grey' },
  idle: { label: 'Idle', dot: '' },
  searching: { label: 'Searching', dot: 'sun' },
  placing: { label: 'Placing ships', dot: 'lilac' },
  'in-match': { label: 'In a match', dot: 'coral' },
}

const OTHER_COLORS = ['var(--lilac)', 'var(--peach)', 'var(--kelp)']

export function LobbyScreen({ state, onStartGame }: { state: GameState; onStartGame: () => void }) {
  const { t } = usePreferences()
  // The lobby list I had when I pressed Start game. Until the server sends a
  // new one, trust the press; after that, trust my status in the list.
  const [pressedAt, setPressedAt] = useState<LobbyClient[] | null>(null)
  const myStatus = state.lobby.find((c) => c.id === state.myId)?.status
  const searching = myStatus === 'searching' || pressedAt === state.lobby

  const start = () => {
    setPressedAt(state.lobby)
    onStartGame()
  }

  return (
    <main className="home">
      <Hero />
      <aside className="home-side">
        <div className="card join">
          <h2>{t('Ahoy, captain', 'สวัสดี กัปตัน')}</h2>
          <div className="field captain-name-display">{state.myName}</div>
          <p className="hint">
            {searching
              ? t('You will be paired with the next captain who presses Start playing.', 'คุณจะได้จับคู่กับกัปตันคนถัดไปที่กดเริ่มเกม')
              : t("Press Start playing when you're ready to play.", "กดเริ่มเกมเมื่อคุณพร้อมเล่น")}
          </p>
          <button type="button" className="btn wide" disabled={searching} onClick={start}>
            {searching ? t('Looking for an opponent…', 'กำลังหาคู่แข่ง…') : t('Start playing', 'เริ่มเล่น')}
          </button>
          <p className="conn"><span className="dot" />{t('Connected to game server automatically', 'เชื่อมต่อเซิร์ฟเวอร์เกมแล้ว')}</p>
        </div>
        <section className="card lobby" aria-labelledby="lobby-title">
          <div className="lobby-head">
            <h3 id="lobby-title">{t('Captains online', 'กัปตันออนไลน์')}</h3>
            <span className="count">{state.lobby.length}</span>
          </div>
          <ul>
            {state.lobby.map((client, i) => {
              const you = client.id === state.myId
              const status = STATUS[client.status] ?? STATUS.idle
              return (
                <li key={client.id} className="who">
                  <Avatar name={client.name} color={you ? 'var(--sun)' : client.name ? OTHER_COLORS[i % OTHER_COLORS.length] : '#C3D3E3'} />
                  <span className="who-name">
                    {client.name ?? <em>{t('connecting…', 'กำลังเชื่อมต่อ…')}</em>}
                    {you && <small>{t("That's you", 'นี่คือคุณ')}</small>}
                  </span>
                  <span className="pill">
                    <span className={`dot ${status.dot}`} />
                    {t(status.label, ({ connecting: 'กำลังเชื่อมต่อ…', idle: 'ว่าง', searching: 'กำลังค้นหา', placing: 'กำลังวางเรือ', 'in-match': 'กำลังเล่น' })[client.status])}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      </aside>
    </main>
  )
}

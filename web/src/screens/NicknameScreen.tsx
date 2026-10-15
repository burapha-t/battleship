import { localizeMessage } from '../localizeMessage'
import { usePreferences } from '../preferences'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Hero } from '../components/Hero'
import type { GameState } from '../gameReducer'
import './screens.css'

const MAX_NICKNAME = 16

type Props = {
  /** False until `connected` arrives. */
  initialNickname?: string
  connected: boolean
  lastError: GameState['lastError']
  onJoin: (nickname: string) => void
}

export function NicknameScreen({ initialNickname = '', connected, lastError, onJoin }: Props) {
  const { t, language } = usePreferences()
  const [nickname, setNickname] = useState(initialNickname)
  // The lastError at the moment I pressed Join: until it changes, the join is
  // still in flight (a `welcome` moves on to the lobby, an `error` comes back).
  const [sentWith, setSentWith] = useState<GameState['lastError'] | undefined>(undefined)
  const pending = sentWith !== undefined && lastError === sentWith
  const answered = sentWith !== undefined && lastError !== sentWith
  const badNickname = answered && lastError?.code === 'bad-nickname' ? lastError.message : null

  const join = (e: FormEvent) => {
    e.preventDefault()
    setSentWith(lastError)
    onJoin(nickname)
  }

  return (
    <main className="home">
      <Hero />
      <aside className="home-side">
        <form className="card join" onSubmit={join}>
          <h2>{t('Ahoy, captain!', 'พร้อมออกเรือไหม กัปตัน!')}</h2>
          <p className="hint">{t('Choose a nickname your opponent will see.', 'ชื่อกัปตันพร้อมแล้ว เข้าร่วมเซิร์ฟเวอร์เพื่อเล่นออนไลน์')}</p>
          <input
            className="field"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={MAX_NICKNAME}
            placeholder={t('Your nickname', 'ชื่อเล่นของคุณ')}
            aria-label={t('Nickname', 'ชื่อเล่น')}
            aria-invalid={badNickname !== null}
            aria-describedby={badNickname ? 'nickname-error' : undefined}
            autoFocus
            autoComplete="off"
          />
          {badNickname && (
            <p id="nickname-error" className="field-error" role="alert">
              {localizeMessage(badNickname, language)}
            </p>
          )}
          <button type="submit" className="btn wide" disabled={!connected || pending || !nickname.trim()}>
            {pending ? t('Joining…', 'กำลังเข้าร่วม…') : t('Join online game', 'เข้าร่วมเกมออนไลน์')}
          </button>
          <p className="conn">
            <span className={connected ? 'dot' : 'dot sun'} />
            {connected ? t('Connected to game server automatically', 'เชื่อมต่อเซิร์ฟเวอร์เกมแล้ว') : t('Connecting to game server…', 'กำลังเชื่อมต่อเซิร์ฟเวอร์เกม…')}
          </p>
        </form>
      </aside>
    </main>
  )
}

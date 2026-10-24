import { useTranslation } from '../useTranslation'
import { translator } from '../translations'
import { useState } from 'react'
import { localizeError } from '../localizeMessage'
import type { FormEvent } from 'react'
import { Hero } from '../components/Hero'
import type { GameState } from '../gameReducer'
import './screens.css'

const MAX_NICKNAME = 16

type Props = {
  /** False until `connected` arrives. */
  connected: boolean
  lastError: GameState['lastError']
  onJoin: (nickname: string) => void
  /** Shows the login card instead. */
  onLogin: () => void
}

export function NicknameScreen({ connected, lastError, onJoin, onLogin }: Props) {
  const { t, language } = useTranslation('game')
  const [nickname, setNickname] = useState('')
  // The lastError at the moment I pressed Join: until it changes, the join is
  // still in flight (a `welcome` moves on to the lobby, an `error` comes back).
  const [sentWith, setSentWith] = useState<GameState['lastError'] | undefined>(undefined)
  const pending = sentWith !== undefined && lastError === sentWith
  const answered = sentWith !== undefined && lastError !== sentWith
  const badNickname = answered && lastError?.code === 'bad-nickname' ? localizeError(lastError, language) : null

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
          <h2>{t('ahoy')}</h2>
          <p className="hint">{t('nicknameHint')}</p>
          <input
            className="field"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={MAX_NICKNAME}
            placeholder={t('nicknamePlaceholder')}
            aria-label={t('nickname')}
            aria-invalid={badNickname !== null}
            aria-describedby={badNickname ? 'nickname-error' : undefined}
            autoFocus
            autoComplete="off"
          />
          {badNickname && (
            <p id="nickname-error" className="field-error" role="alert">
              {badNickname}
            </p>
          )}
          <button type="submit" className="btn wide" disabled={!connected || pending || !nickname.trim()}>
            {pending ? t('joining') : t('join')}
          </button>
          <p className="conn">
            <span className={connected ? 'dot' : 'dot sun'} />
            {connected ? t('connected') : t('connectingServer')}
          </p>
        </form>
        <button type="button" className="switch-link" onClick={onLogin} disabled={pending}>
          {translator(language, 'login')('logInOrSignUp')}
        </button>
      </aside>
    </main>
  )
}

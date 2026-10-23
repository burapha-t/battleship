import { useState } from 'react'
import type { FormEvent } from 'react'
import type { GameState } from '../gameReducer'
import { fieldsFor, initialOf, PASSWORD_MAX, USERNAME_MAX, validate } from '../login'
import type { AuthField, AuthMode } from '../login'
import { localizeError } from '../localizeMessage'
import { translator } from '../translations'
import { useTranslation } from '../useTranslation'
import './screens.css'
import './login.css'

type Props = {
  /** False until `connected` arrives. */
  connected: boolean
  lastError: GameState['lastError']
  /** Sends `login` or `signup`; a `welcome` moves on to the lobby. */
  onSend: (mode: AuthMode, username: string, password: string) => void
  /** Shows the nickname screen instead. */
  onGuest: () => void
}

/** The captain's ID card, after docs/frontend/0_login.html and 0_signup.html. */
export function LoginScreen({ connected, lastError, onSend, onGuest }: Props) {
  const { language, t } = useTranslation('login')
  const game = translator(language, 'game')
  const [mode, setMode] = useState<AuthMode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  // The eye beside the password: show it as plain text.
  const [reveal, setReveal] = useState(false)
  // What I sent: the lastError at that moment and the tab. Until lastError
  // changes the request is in flight (a `welcome` moves on, an `error` comes back).
  const [sent, setSent] = useState<{ lastError: GameState['lastError']; mode: AuthMode } | null>(null)
  // The input that broke the rules here, before anything was sent.
  const [problem, setProblem] = useState<AuthField | null>(null)

  const pending = sent !== null && lastError === sent.lastError
  const answer = sent !== null && lastError !== sent.lastError ? lastError : null
  const message = problem
    ? t(problem === 'username' ? 'usernameRule' : 'passwordRule')
    : answer && localizeError(answer, language)
  const bad = (field: AuthField) => (problem ? problem === field : answer ? fieldsFor(answer.code).includes(field) : false)

  // Any edit or tab switch hides the error until the next submit.
  const clearError = () => {
    setProblem(null)
    setSent(null)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!connected || pending) return
    const found = validate(username, password)
    setProblem(found)
    if (found) return
    setSent({ lastError, mode })
    onSend(mode, username.trim(), password)
  }

  const name = username.trim()
  const buttonText = pending
    ? t(sent.mode === 'login' ? 'loggingIn' : 'signingUp')
    : t(mode === 'login' ? 'logIn' : 'signUp')

  return (
    <main className="login">
      <form className="card idcard" onSubmit={submit}>
        <div className="idhead">
          <span>
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="5" r="2.2" />
              <path d="M12 7.2V21" />
              <path d="M8 11h8" />
              <path d="M4.5 14.5c.5 3.6 3.6 6.5 7.5 6.5s7-2.9 7.5-6.5" />
            </svg>
            {t('brand')}
          </span>
          <small>{t('idCard')}</small>
        </div>

        {/* The name as typed: a blank slot until sign-up issues the card. */}
        <div className="stub" aria-hidden>
          {mode === 'login' ? (
            <>
              <div className="photo">{initialOf(name) ?? '?'}</div>
              <div className="rank">{t('captain')}</div>
            </>
          ) : (
            <>
              <div className="photo new">?</div>
              <div className="rank">{t('newCaptain')}</div>
            </>
          )}
          {/* A no-break space keeps the line's height while the name is empty. */}
          <div className="holder">{name || ' '}</div>
          <div className="barcode" />
        </div>

        <div className="form">
          <div className="tabs" role="tablist">
            {(['login', 'signup'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={mode === tab}
                className={mode === tab ? 'tab on' : 'tab'}
                disabled={pending}
                onClick={() => {
                  setMode(tab)
                  clearError()
                }}
              >
                {t(tab === 'login' ? 'logIn' : 'signUp')}
              </button>
            ))}
          </div>
          <h1>{t(mode === 'login' ? 'welcomeBack' : 'welcomeAboard')}</h1>

          <label htmlFor="login-username">{t('username')}</label>
          <input
            id="login-username"
            className={bad('username') ? 'field bad' : 'field'}
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
              clearError()
            }}
            maxLength={USERNAME_MAX}
            readOnly={pending}
            aria-invalid={bad('username')}
            aria-describedby={message ? 'login-error' : undefined}
            autoComplete="username"
            autoCapitalize="off"
            spellCheck={false}
            autoFocus
          />
          <label htmlFor="login-password">{t('password')}</label>
          <div className="pw-box">
            <input
              id="login-password"
              type={reveal ? 'text' : 'password'}
              // .pw spaces out the dots; shown as text it reads like the username.
              className={`field${reveal ? '' : ' pw'}${bad('password') ? ' bad' : ''}`}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                clearError()
              }}
              maxLength={PASSWORD_MAX}
              readOnly={pending}
              aria-invalid={bad('password')}
              aria-describedby={message ? 'login-error' : undefined}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              // Shown as text, a password must not reach spellcheck or autocorrect.
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <button
              type="button"
              className="eye"
              onClick={() => setReveal(!reveal)}
              aria-label={t(reveal ? 'hidePassword' : 'showPassword')}
              aria-controls="login-password"
              aria-pressed={reveal}
              title={t(reveal ? 'hidePassword' : 'showPassword')}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" fill="#fff" stroke="#14325A" strokeWidth="2.4" strokeLinejoin="round" />
                <circle cx="12" cy="12" r="3.2" fill="#FFC83D" stroke="#14325A" strokeWidth="2.2" />
                {reveal && <path d="M4 4l16 16" fill="none" stroke="#14325A" strokeWidth="2.6" strokeLinecap="round" />}
              </svg>
            </button>
          </div>

          <button type="submit" className={pending ? 'btn pressed' : 'btn'} disabled={!connected || pending}>
            {buttonText}
          </button>
          {message && (
            <p id="login-error" className="login-error" role="alert">
              {message}
            </p>
          )}
          <p className="conn">
            <span className={connected ? 'dot' : 'dot sun'} />
            {game(connected ? 'connected' : 'connectingServer')}
          </p>
        </div>
      </form>

      <button type="button" className="switch-link" onClick={onGuest} disabled={pending}>
        {t('playAsGuest')}
      </button>
    </main>
  )
}

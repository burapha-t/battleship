import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { GameState } from '../gameReducer'
import { AUTH_ERRORS, idNumberFor, initialOf, PASSWORD_MAX, USERNAME_MAX, validate } from '../login'
import type { AuthField, AuthMode, AuthProblem } from '../login'
import './login.css'

/** How long the anchor bar takes to fill once the server lets me in. */
const ANCHOR_MS = 1000

type Props = {
  /** False until the server's `connected`. */
  connected: boolean
  lastError: GameState['lastError']
  /** The name from `welcome`, once the server has let me in. */
  welcomedAs: string | null
  onLogin: (username: string, password: string) => void
  onSignup: (username: string, password: string) => void
  /** Called once the anchor bar has filled after `welcome`. */
  onBoarded: () => void
}

export function LoginScreen({ connected, lastError, welcomedAs, onLogin, onSignup, onBoarded }: Props) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  // The eye beside the password: show it as plain text.
  const [reveal, setReveal] = useState(false)
  // What I sent: the lastError at that moment and the tab. Until lastError
  // changes the request is in flight (a `welcome` comes back, or an `error`).
  const [sent, setSent] = useState<{ lastError: GameState['lastError']; mode: AuthMode } | null>(null)
  // A problem found here, before sending anything.
  const [problem, setProblem] = useState<AuthProblem | null>(null)
  const [pct, setPct] = useState(0)

  const welcomed = welcomedAs !== null
  const pending = !welcomed && sent !== null && lastError === sent.lastError
  const locked = pending || welcomed
  // The server's answer, as a message and the inputs it is about.
  const answer: AuthProblem | null =
    !welcomed && sent !== null && lastError !== null && lastError !== sent.lastError
      ? (AUTH_ERRORS[lastError.code] ?? { fields: [], message: lastError.message })
      : null
  const shown = problem ?? answer
  const bad = (field: AuthField) => shown?.fields.includes(field) ?? false

  // Any edit or tab switch hides the error until the next submit.
  const clearError = () => {
    setProblem(null)
    setSent(null)
  }
  const pickMode = (next: AuthMode) => {
    setMode(next)
    clearError()
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!connected || locked) return
    const found = validate(mode, username, password)
    setProblem(found)
    if (found) return
    setSent({ lastError, mode })
    ;(mode === 'login' ? onLogin : onSignup)(username.trim(), password)
  }

  // Fill the bar after `welcome`, then board. The cleanup cancels the frame, so
  // a StrictMode re-run restarts it and `onBoarded` still fires only once.
  const boarded = useRef(onBoarded)
  useEffect(() => {
    boarded.current = onBoarded
  })
  useEffect(() => {
    if (!welcomed) return
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const next = Math.min(100, Math.floor((Math.max(0, now - start) / ANCHOR_MS) * 100))
      setPct(next)
      if (next < 100) frame = requestAnimationFrame(tick)
      else boarded.current()
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [welcomed])

  const name = welcomedAs ?? username.trim()
  const label = (sent?.mode ?? mode) === 'login' ? 'Log in' : 'Sign up'
  // Signing up logs in too, so a welcome always ends on "Logging in…".
  const buttonText = welcomed || (pending && sent.mode === 'login') ? 'Logging in…' : pending ? 'Signing up…' : label

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
            Battleship fleet
          </span>
          <small>CAPTAIN'S ID</small>
        </div>

        {/* The ID so far: a blank slot before sign-up, the stamped card after. */}
        <div className="stub" aria-hidden>
          {mode === 'login' || welcomed ? (
            <>
              <div className="photo">{initialOf(name) ?? '?'}</div>
              <div className="rank">Captain</div>
              <div className="holder">{name || ' '}</div>
              <div className="no">ID no. {idNumberFor(name)}</div>
            </>
          ) : (
            <>
              <div className="photo new">?</div>
              <div className="rank">New captain</div>
              <div className="holder">{name || ' '}</div>
              <div className="no">ID no. issued on sign up</div>
            </>
          )}
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
                disabled={locked}
                onClick={() => pickMode(tab)}
              >
                {tab === 'login' ? 'Log in' : 'Sign up'}
              </button>
            ))}
          </div>
          <h1>{mode === 'login' ? 'Welcome back, captain!' : 'Welcome aboard, captain!'}</h1>

          <label htmlFor="login-username">Username</label>
          <input
            id="login-username"
            className={bad('username') ? 'field bad' : 'field'}
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
              clearError()
            }}
            maxLength={USERNAME_MAX}
            readOnly={locked}
            aria-invalid={bad('username')}
            aria-describedby={shown ? 'login-error' : undefined}
            autoComplete="username"
            autoCapitalize="off"
            spellCheck={false}
            autoFocus
          />
          <label htmlFor="login-password">Password</label>
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
              readOnly={locked}
              aria-invalid={bad('password')}
              aria-describedby={shown ? 'login-error' : undefined}
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
              aria-label={reveal ? 'Hide password' : 'Show password'}
              aria-controls="login-password"
              aria-pressed={reveal}
              title={reveal ? 'Hide password' : 'Show password'}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" fill="#fff" stroke="#14325A" strokeWidth="2.4" strokeLinejoin="round" />
                <circle cx="12" cy="12" r="3.2" fill="#FFC83D" stroke="#14325A" strokeWidth="2.2" />
                {reveal && <path d="M4 4l16 16" fill="none" stroke="#14325A" strokeWidth="2.6" strokeLinecap="round" />}
              </svg>
            </button>
          </div>

          <button type="submit" className={locked ? 'btn pressed' : 'btn'} disabled={!connected || locked}>
            {buttonText}
          </button>
          {shown && (
            <p id="login-error" className="login-error" role="alert">
              {shown.message}
            </p>
          )}
        </div>

        {welcomed && <div className="stamp">Cleared to sail</div>}
      </form>

      {welcomed && (
        <div className="load">
          <div className="row">
            <b>Raising the anchor…</b>
            <span>{pct}%</span>
          </div>
          <div className="track" role="progressbar" aria-label="Raising the anchor" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <i style={{ width: `${pct}%`, borderRightWidth: pct === 0 ? 0 : undefined }} />
          </div>
        </div>
      )}
    </main>
  )
}

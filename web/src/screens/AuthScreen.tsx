import { useState } from 'react'
import type { FormEvent } from 'react'
import { accountRequest } from '../auth'
import type { Account } from '../auth'
import { Hero } from '../components/Hero'
import './screens.css'

export function AuthScreen({ onLogin }: { onLogin: (account: Account) => void }) {
  const [register, setRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setError(''); setNotice('')
    if (register && password !== confirm) { setError('Passwords do not match.'); return }
    setBusy(true)
    try {
      if (register) {
        await accountRequest('register', { email, password, displayName })
        setRegister(false); setPassword(''); setConfirm('')
        setNotice('Account created! Log in to set sail.')
      } else {
        onLogin(await accountRequest<Account>('login', { email, password }))
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not reach the account server. Try again.')
    } finally { setBusy(false) }
  }

  return <main className="home">
    <Hero />
    <aside className="home-side">
      <form className="card join auth-form" onSubmit={submit}>
        <h2>{register ? 'Join the crew!' : 'Welcome back, captain!'}</h2>
        <p className="hint">{register ? 'Create your Battleship account.' : 'Log in to set sail with your crew.'}</p>
        {register && <label>Nickname<input className="field" value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={16} required autoComplete="nickname" /></label>}
        <label>Email<input className="field" type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} required autoComplete="username" /></label>
        <label>Password<input className="field" type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={register ? 8 : undefined} maxLength={128} required autoComplete={register ? 'new-password' : 'current-password'} aria-describedby={register ? 'password-help' : undefined} /></label>
        {register && <>
          <p id="password-help" className="hint">8–128 characters, including uppercase, lowercase, a number and a symbol.</p>
          <label>Confirm password<input className="field" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} maxLength={128} required autoComplete="new-password" /></label>
        </>}
        {error && <p className="field-error" role="alert">{error}</p>}
        {notice && <p className="hint" role="status">{notice}</p>}
        <button className="btn wide" type="submit" disabled={busy}>{busy ? 'Please wait…' : register ? 'Create account' : 'Log in'}</button>
        <button className="btn white wide auth-switch" type="button" disabled={busy} onClick={() => { setRegister(!register); setError(''); setNotice(''); setPassword(''); setConfirm('') }}>
          {register ? 'Already have an account? Log in' : 'New captain? Create an account'}
        </button>
      </form>
    </aside>
  </main>
}

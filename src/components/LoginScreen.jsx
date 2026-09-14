import { useState } from 'react'
import { Icon } from './Icons.jsx'
import { APP_NAME, BRAND_MARK } from '../config.js'

const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname)

/**
 * Sign-in. Shown on its own when nobody is signed in, or laid over the app when a session ran out
 * in the middle of something — the work underneath is kept, and signing in again carries on with it.
 */
export default function LoginScreen({ onSignIn, expired, overlay = false }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSignIn(username.trim(), password)
    } catch (failure) {
      setError(failure.message)
      setBusy(false)
    }
  }

  const card = (
    <form className="login-card" onSubmit={submit} aria-label="Sign in">
      <div className="brand login-brand">
        <span className="brand-mark" aria-hidden="true">{BRAND_MARK}</span>
        <span>{APP_NAME}</span>
      </div>

      <p className="login-lead">
        {expired
          ? overlay
            ? 'Your session has ended. Sign in again to carry on — nothing you were working on is lost.'
            : 'Your session has ended. Sign in again to carry on.'
          : 'Sign in with your directory account.'}
      </p>

      <label className="login-field">
        <span>Username</span>
        <input
          className="input"
          value={username}
          autoFocus
          autoComplete="username"
          onChange={(event) => setUsername(event.target.value)}
        />
      </label>

      <label className="login-field">
        <span>Password</span>
        <input
          className="input"
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>

      {error && (
        <p className="login-error" role="alert">
          {error}
        </p>
      )}

      <button className="btn btn-primary login-submit" type="submit" disabled={busy || !username || !password}>
        {busy ? <span className="spinner" /> : <Icon.Lock />}
        Sign in
      </button>

      {isLocal && (
        <p className="login-hint">
          Local directory, password <code>secret</code>: <code>alice</code> admin · <code>bob</code> editor ·{' '}
          <code>dave</code> viewer · <code>carol</code> has no access
        </p>
      )}
    </form>
  )

  if (overlay) {
    return <div className="overlay login-overlay">{card}</div>
  }
  return <div className="login">{card}</div>
}

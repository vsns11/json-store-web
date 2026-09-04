import { useState } from 'react'
import { Icon } from './Icons.jsx'

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
        <span className="brand-mark">{'{}'}</span>
        <span>JSON Store</span>
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
          Local directory: <code>alice / secret</code> (admins, may delete) · <code>bob / secret</code> (developers)
        </p>
      )}
    </form>
  )

  if (overlay) {
    return <div className="overlay login-overlay">{card}</div>
  }
  return <div className="login">{card}</div>
}

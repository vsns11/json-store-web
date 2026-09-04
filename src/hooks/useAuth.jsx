import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, clearSession, hasToken, setUnauthorizedHandler, tokenExpiresAt } from '../api/client.js'

const AuthContext = createContext(null)

/** How long before a token runs out it is exchanged for a new one. */
const REFRESH_MARGIN_MS = 5 * 60_000
/** Never sooner than this, so a token shorter than the margin is renewed at half-life, not in a loop. */
const REFRESH_FLOOR_MS = 10_000

/**
 * Sign-in state. Credentials are exchanged for a bearer token once, against LDAP; the token is
 * what every later request carries, so the API keeps no session.
 *
 * `status` is one of:
 *   checking   a token from a previous visit is being confirmed with the API
 *   anonymous  nobody is signed in; show the sign-in screen
 *   signed-in  the token works
 *   expired    the token stopped working mid-session; the app stays up so nothing typed is lost,
 *              and the sign-in screen is laid over it
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState(hasToken() ? 'checking' : 'anonymous')
  // Set when the API rejected a token that had been working, so the sign-in screen can say why
  // it is being shown again rather than appearing out of nowhere.
  const [expired, setExpired] = useState(false)

  const signOut = useCallback(() => {
    clearSession()
    setUser(null)
    setExpired(false)
    setStatus('anonymous')
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setExpired(true)
      // Only a session that was actually running is worth keeping the app open for. Several
      // requests usually fail together, so a second rejection must not undo the first.
      setStatus((current) => (current === 'signed-in' || current === 'expired' ? 'expired' : 'anonymous'))
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  // A token from a previous visit is only trusted once the API confirms it.
  useEffect(() => {
    if (!hasToken()) return undefined
    let cancelled = false
    api
      .me()
      .then((me) => {
        if (cancelled) return
        setUser(me)
        setStatus('signed-in')
      })
      .catch(() => {
        // A rejected token has already been cleared by the API client, which also flags the
        // session as expired; anything else simply leaves the sign-in screen as it was.
        if (!cancelled) setStatus('anonymous')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Renew the token shortly before it runs out, and again whenever the tab comes back into view
  // after a while away — browsers slow timers right down in a background tab. A refresh the API
  // refuses is left alone: the token then runs out on its own, and the next request asks to sign in.
  useEffect(() => {
    if (status !== 'signed-in') return undefined
    let timer

    const schedule = () => {
      clearTimeout(timer)
      const expiresAt = tokenExpiresAt()
      if (!expiresAt) return
      const remaining = expiresAt - Date.now()
      const delay = Math.max(remaining - REFRESH_MARGIN_MS, remaining / 2, REFRESH_FLOOR_MS)
      timer = setTimeout(() => {
        api.refresh().then(schedule, () => {})
      }, delay)
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') schedule()
    }

    schedule()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [status])

  const signIn = useCallback(async (username, password) => {
    const session = await api.login(username, password)
    setUser(session.user)
    setExpired(false)
    setStatus('signed-in')
    return session
  }, [])

  const value = useMemo(
    () => ({ user, status, expired, signIn, signOut }),
    [user, status, expired, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside an AuthProvider')
  return context
}

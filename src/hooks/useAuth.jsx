import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, hasToken, setToken, setUnauthorizedHandler } from '../api/client.js'

const AuthContext = createContext(null)

/**
 * Sign-in state. Credentials are exchanged for a bearer token once, against LDAP; the token is
 * what every later request carries, so the API keeps no session.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState(hasToken() ? 'checking' : 'anonymous')
  // Set when the API rejected a token that had been working, so the sign-in screen can say why
  // it is being shown again rather than appearing out of nowhere.
  const [expired, setExpired] = useState(false)

  const signOut = useCallback(() => {
    setToken(null)
    setUser(null)
    setExpired(false)
    setStatus('anonymous')
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null)
      setExpired(true)
      setStatus('anonymous')
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  // A token from a previous visit is only trusted once the API confirms it.
  useEffect(() => {
    if (!hasToken()) return
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

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

  const signOut = useCallback(() => {
    setToken(null)
    setUser(null)
    setStatus('anonymous')
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null)
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
        if (!cancelled) signOut()
      })
    return () => {
      cancelled = true
    }
  }, [signOut])

  const signIn = useCallback(async (username, password) => {
    const session = await api.login(username, password)
    setUser({ username: session.username, roles: session.roles })
    setStatus('signed-in')
    return session
  }, [])

  const value = useMemo(() => ({ user, status, signIn, signOut }), [user, status, signIn, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside an AuthProvider')
  return context
}

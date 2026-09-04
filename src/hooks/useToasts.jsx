import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const ToastContext = createContext(null)

/** How long the oldest toast stays on screen, and how many are ever shown at once. */
const VISIBLE_FOR_MS = 5000
const MAX_VISIBLE = 3

let nextId = 0

/**
 * Short messages that need attention but not a decision — mostly failures.
 *
 * Anything routine belongs in the page itself rather than here: a toast interrupts, and five of
 * them stacked up say nothing the first one did not. Two rules keep that from happening:
 * repeating a message counts it up instead of stacking a copy, and only the newest few are kept.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  // One timer for whatever is on screen: it drops the oldest toast, then runs again for the next.
  // Every change to the list restarts it, so a message that just repeated stays a little longer.
  useEffect(() => {
    if (toasts.length === 0) return undefined
    const timer = setTimeout(() => setToasts((current) => current.slice(1)), VISIBLE_FOR_MS)
    return () => clearTimeout(timer)
  }, [toasts])

  const push = useCallback((message, tone) => {
    setToasts((current) => {
      const twin = current.find((toast) => toast.message === message && toast.tone === tone)
      if (twin) {
        return current.map((toast) => (toast.id === twin.id ? { ...toast, repeats: toast.repeats + 1 } : toast))
      }
      nextId += 1
      return [...current, { id: nextId, message, tone, repeats: 1 }].slice(-MAX_VISIBLE)
    })
  }, [])

  // Each action keeps a stable identity, so effects can depend on them without re-running.
  const success = useCallback((message) => push(message, 'success'), [push])
  const error = useCallback((message) => push(message, 'error'), [push])
  const info = useCallback((message) => push(message, 'info'), [push])

  const value = useMemo(
    () => ({ toasts, dismiss, success, error, info }),
    [toasts, dismiss, success, error, info],
  )

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

export function useToasts() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToasts must be used inside a ToastProvider')
  return context
}

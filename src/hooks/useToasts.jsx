import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const ToastContext = createContext(null)

let nextId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback(
    (message, tone = 'info') => {
      const id = ++nextId
      setToasts((current) => [...current, { id, message, tone }])
      setTimeout(() => dismiss(id), 4000)
    },
    [dismiss],
  )

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

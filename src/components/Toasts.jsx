import { useToasts } from '../hooks/useToasts.jsx'

export default function Toasts() {
  const { toasts, dismiss } = useToasts()

  return (
    <div className="toasts" role="log" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast is-${toast.tone}`}>
          <span className="toast-message">{toast.message}</span>
          {/* The same message repeating is counted, never stacked. */}
          {toast.repeats > 1 && <span className="toast-count">×{toast.repeats}</span>}
          <button className="toast-close" aria-label="Dismiss" onClick={() => dismiss(toast.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

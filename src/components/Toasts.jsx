import { useToasts } from '../hooks/useToasts.jsx'

export default function Toasts() {
  const { toasts, dismiss } = useToasts()

  return (
    <div className="toasts">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast is-${toast.tone}`} role="status" onClick={() => dismiss(toast.id)}>
          {toast.message}
        </div>
      ))}
    </div>
  )
}

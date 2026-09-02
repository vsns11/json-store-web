import { useEffect } from 'react'
import { formatBytes } from '../lib/json.js'
import JsonTree from './JsonTree.jsx'

/** The composed profile, shown on demand rather than taking up half the screen. */
export default function PreviewDialog({ composed, size, onClose }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog dialog-wide" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <header className="dialog-head">
          <h3>Composed profile</h3>
          <span className="muted">{formatBytes(size)}</span>
        </header>

        <div className="dialog-body">
          <JsonTree value={composed} />
        </div>

        <div className="dialog-actions">
          <button className="btn btn-primary" onClick={onClose} autoFocus>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

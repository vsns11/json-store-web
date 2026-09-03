import { useEffect, useState } from 'react'
import { Icon } from './Icons.jsx'
import { formatBytes, formatRelativeTime } from '../lib/json.js'

// "Saved just now" would stay "just now" forever without a nudge, so re-render
// the label every half minute for as long as there is one to show.
function useTick(active) {
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!active) return undefined
    const timer = setInterval(() => setTick((count) => count + 1), 30_000)
    return () => clearInterval(timer)
  }, [active])
}

export default function StatusBar({
  parsed,
  shape,
  size,
  dirty,
  saving,
  isNew,
  savedAt,
  onSave,
  onReload,
  onRevert,
  onDelete,
  onJumpToError,
}) {
  useTick(Boolean(savedAt) && !dirty)

  return (
    <footer className="statusbar">
      <span className={`status-pill ${parsed.ok ? 'is-valid' : parsed.empty ? 'is-empty' : 'is-invalid'}`}>
        <span className="status-dot" /> {parsed.ok ? 'Valid JSON' : parsed.empty ? 'Empty' : 'Invalid'}
      </span>

      {parsed.ok && (
        <span className="status-metrics">
          <span title="Size once stored, with whitespace removed">{formatBytes(size)}</span>
          <span>{shape.keys} keys</span>
          <span>{shape.nodes} nodes</span>
          <span>depth {shape.depth}</span>
        </span>
      )}

      {parsed.empty && <span className="muted">Type the inputs, paste them, drop a .json file, or load a sample</span>}

      {!parsed.ok && !parsed.empty && (
        <button className="btn btn-sm btn-ghost status-error" onClick={onJumpToError} title="Jump to the problem">
          Line {parsed.error.line}, column {parsed.error.column} — {parsed.error.message}
        </button>
      )}

      <div className="status-actions">
        {dirty ? (
          <span className="save-state is-unsaved">
            <span className="unsaved-dot" /> Unsaved changes
          </span>
        ) : (
          savedAt && (
            <span className="save-state is-saved">
              <Icon.Check /> Saved {formatRelativeTime(savedAt)}
            </span>
          )
        )}

        {onReload && (
          <button className="btn btn-sm" onClick={onReload} title="Discard local edits and load the stored version">
            <Icon.Refresh /> Load stored
          </button>
        )}
        {!isNew && (
          <button className="btn btn-sm btn-danger" onClick={onDelete} title="Delete this profile">
            <Icon.Trash /> Delete
          </button>
        )}
        <button className="btn btn-sm" onClick={onRevert} disabled={!dirty}>
          <Icon.Revert /> Revert
        </button>
        <button className="btn btn-sm btn-primary" onClick={onSave} disabled={saving || !parsed.ok || !dirty}>
          {saving ? <span className="spinner" /> : <Icon.Save />}
          {isNew ? 'Save profile' : 'Save changes'}
        </button>
      </div>
    </footer>
  )
}

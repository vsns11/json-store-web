import { useEffect, useState } from 'react'
import { Icon } from './Icons.jsx'
import { formatBytes, formatRelativeTime } from '../lib/json.js'

/**
 * Where the draft stands against the stored profile. This is the only place the app reports a
 * save: it stays on screen instead of flashing past, so there is nothing to catch or dismiss.
 */
function SaveState({ dirty, savedAt }) {
  // "Saved just now" would stay "just now" forever without a nudge, so re-render it now and then.
  const [, setTick] = useState(0)
  const settled = !dirty && Boolean(savedAt)

  useEffect(() => {
    if (!settled) return undefined
    const timer = setInterval(() => setTick((count) => count + 1), 30_000)
    return () => clearInterval(timer)
  }, [settled])

  if (dirty) {
    return (
      <span className="save-state is-unsaved">
        <span className="unsaved-dot" /> Unsaved changes
      </span>
    )
  }

  if (!savedAt) return <span className="save-state is-new">Not saved yet</span>

  return (
    <span className="save-state is-saved">
      <Icon.Check /> Saved {formatRelativeTime(savedAt)}
    </span>
  )
}

export default function StatusBar({
  parsed,
  shape,
  size,
  dirty,
  saving,
  isNew,
  canDelete,
  savedAt,
  note,
  reloading,
  onSave,
  onReload,
  onRevert,
  onDelete,
  onJumpToError,
}) {
  return (
    <footer className="statusbar">
      <span className={`status-pill ${parsed.ok ? 'is-valid' : parsed.empty ? 'is-empty' : 'is-invalid'}`}>
        <span className="status-dot" /> {parsed.ok ? 'Valid JSON' : parsed.empty ? 'Empty' : 'Invalid'}
      </span>

      {/* The counts step aside while a note is showing, so neither has to be truncated. */}
      {parsed.ok && !note && (
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
        {/* What just happened, if anything: one slot that replaces itself and then clears. */}
        {note && <span className="status-note">{note}</span>}

        <SaveState dirty={dirty} savedAt={savedAt} />

        {onReload && (
          <button
            className="btn btn-sm"
            onClick={onReload}
            disabled={reloading}
            title="Load the stored version, discarding any edits here"
          >
            {reloading ? <span className="spinner" /> : <Icon.Refresh />} Reload
          </button>
        )}

        {!isNew && canDelete && (
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

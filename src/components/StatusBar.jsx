import { Icon } from './Icons.jsx'
import { formatBytes } from '../lib/json.js'

export default function StatusBar({ parsed, shape, size, dirty, saving, isNew, onSave, onRevert, onDelete, onJumpToError }) {
  return (
    <footer className="statusbar">
      <span className={`status-pill ${parsed.ok ? 'is-valid' : parsed.empty ? 'is-empty' : 'is-invalid'}`}>
        <span className="status-dot" /> {parsed.ok ? 'Valid JSON' : parsed.empty ? 'Empty' : 'Invalid'}
      </span>

      {parsed.ok && (
        <span className="status-metrics">
          <span>{formatBytes(size)}</span>
          <span>{shape.keys} keys</span>
          <span>{shape.nodes} nodes</span>
          <span>depth {shape.depth}</span>
        </span>
      )}

      {parsed.empty && <span className="muted">Type, paste, drop a .json file, or load a sample to get started</span>}

      {!parsed.ok && !parsed.empty && (
        <button className="btn btn-sm btn-ghost status-error" onClick={onJumpToError} title="Jump to the problem">
          Line {parsed.error.line}, column {parsed.error.column} — {parsed.error.message}
        </button>
      )}

      <div className="status-actions">
        {dirty && (
          <span className="muted" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span className="unsaved-dot" /> Unsaved changes
          </span>
        )}
        {!isNew && (
          <button className="btn btn-sm btn-danger" onClick={onDelete} title="Delete this document">
            <Icon.Trash /> Delete
          </button>
        )}
        <button className="btn btn-sm" onClick={onRevert} disabled={!dirty}>
          <Icon.Revert /> Revert
        </button>
        <button className="btn btn-sm btn-primary" onClick={onSave} disabled={saving || !parsed.ok || !dirty}>
          {saving ? <span className="spinner" /> : <Icon.Save />}
          {isNew ? 'Save to Postgres' : 'Save changes'}
        </button>
      </div>
    </footer>
  )
}

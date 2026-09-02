import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { describeValue, diffJson } from '../lib/diff.js'
import { Icon } from './Icons.jsx'

/**
 * Compares the open profile's inputs with another one's. Scenario profiles are usually near-copies
 * of each other, so the useful question is which paths differ, not what the two documents look like.
 */
export default function CompareDialog({ current, onClose }) {
  const [search, setSearch] = useState('')
  const [candidates, setCandidates] = useState([])
  const [other, setOther] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      api
        .list({ search, size: 8 })
        .then((page) => setCandidates(page.items.filter((item) => item.id !== current.id)))
        .catch((failure) => setError(failure.message))
    }, 200)
    return () => clearTimeout(timer)
  }, [search, current.id])

  useEffect(() => {
    const onKeyDown = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const open = async (id) => {
    try {
      setOther(await api.get(id))
    } catch (failure) {
      setError(failure.message)
    }
  }

  const changes = other ? diffJson(other.payload, current.payload) : []

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog dialog-wide" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <header className="dialog-head">
          <h3>{other ? `Compared with “${other.name}”` : 'Compare with another profile'}</h3>
          {other && <span className="muted">{changes.length} difference{changes.length === 1 ? '' : 's'}</span>}
        </header>

        {error && <p className="notice">{error}</p>}

        {!other ? (
          <>
            <input
              className="input"
              value={search}
              autoFocus
              placeholder="Search profiles…"
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="dialog-body compare-list">
              {candidates.length === 0 && <p className="muted compare-empty">No other profile matches.</p>}
              {candidates.map((item) => (
                <button className="compare-choice" key={item.id} onClick={() => open(item.id)}>
                  <span className="cell-name">{item.name}</span>
                  <span className="cell-sub">{item.description || item.preview}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="dialog-body">
            {changes.length === 0 ? (
              <p className="muted compare-empty">The inputs are identical.</p>
            ) : (
              <table className="table compare-table">
                <thead>
                  <tr>
                    <th>Path</th>
                    <th>“{other.name}”</th>
                    <th>This profile</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((change) => {
                    const before = describeValue(change.before)
                    const after = describeValue(change.after)
                    return (
                      <tr key={change.path}>
                        <td className="cell-mono">{change.path}</td>
                        <td className={`compare-before is-${change.kind}`} title={before.full}>
                          {before.short}
                        </td>
                        <td className={`compare-after is-${change.kind}`} title={after.full}>
                          {after.short}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        <div className="dialog-actions">
          {other && (
            <button className="btn" onClick={() => setOther(null)}>
              <Icon.Back /> Pick another
            </button>
          )}
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

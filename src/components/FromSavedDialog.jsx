import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client.js'
import { loadCatalog } from '../lib/catalog.js'
import { combineProfiles, describeOverlap } from '../lib/combine.js'
import Dialog from './Dialog.jsx'

/**
 * Picks saved profiles to start a new one from. One picked is a copy; several are combined, each
 * bringing the templates and values it was saved with. What they add up to is shown before anything
 * opens, overlaps included, and nothing is saved until the new profile is.
 */
export default function FromSavedDialog({ onClose, onOpen }) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)
  // Full profiles, in the order picked: the order decides which wins where two overlap.
  const [picked, setPicked] = useState([])
  const [loadingId, setLoadingId] = useState(null)
  const [catalog, setCatalog] = useState(null)

  useEffect(() => {
    loadCatalog()
      .then(setCatalog)
      .catch((failure) => setError(failure.message))
  }, [])

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(
      () => {
        api
          .list({ search, size: 50, sort: 'name', direction: 'asc' })
          .then((page) => {
            if (cancelled) return
            setResults(page.items)
            setError(null)
          })
          .catch((failure) => {
            if (!cancelled) setError(failure.message)
          })
      },
      search ? 250 : 0,
    )
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [search])

  const combined = useMemo(
    () => (catalog && picked.length > 0 ? combineProfiles(catalog, picked) : null),
    [catalog, picked],
  )
  const usable = Boolean(combined && Object.values(combined.selection).some(Boolean))

  const toggle = async (summary) => {
    if (picked.some((profile) => profile.id === summary.id)) {
      setPicked((current) => current.filter((profile) => profile.id !== summary.id))
      return
    }
    // The list leaves templates out, so the profile itself is fetched once it is picked.
    setLoadingId(summary.id)
    try {
      const profile = await api.get(summary.id)
      setPicked((current) => [...current, profile])
    } catch (failure) {
      setError(failure.message)
    } finally {
      setLoadingId(null)
    }
  }

  const move = (index, by) => {
    setPicked((current) => {
      const next = [...current]
      const [profile] = next.splice(index, 1)
      next.splice(index + by, 0, profile)
      return next
    })
  }

  return (
    <Dialog
      title="Start from saved profiles"
      wide
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!usable} onClick={() => onOpen(picked)}>
            Open as a new profile
          </button>
        </>
      }
    >
      <div className="from-saved-body">
        <p className="from-saved-intro">
          Pick one or more. Their templates and values are combined into a new profile, which is not saved until
          you save it. Where two overlap, the one picked later is used.
        </p>
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}

        <div className="from-saved">
          <section aria-label="Saved profiles">
            <input
              className="input"
              type="search"
              value={search}
              placeholder="Find a saved profile…"
              aria-label="Find a saved profile"
              onChange={(event) => setSearch(event.target.value)}
            />
            <ul className="pick-list">
              {results === null ? (
                <li className="pick-empty muted">Loading…</li>
              ) : results.length === 0 ? (
                <li className="pick-empty muted">No saved profiles match.</li>
              ) : (
                results.map((item) => {
                  const position = picked.findIndex((profile) => profile.id === item.id)
                  return (
                    <li key={item.id}>
                      <label className="pick-row">
                        <input
                          type="checkbox"
                          checked={position >= 0}
                          disabled={loadingId === item.id}
                          onChange={() => toggle(item)}
                        />
                        <span className="pick-name">{item.name}</span>
                        {position >= 0 ? (
                          <span className="pick-order" title={`Picked ${position + 1}`}>
                            {position + 1}
                          </span>
                        ) : (
                          <span />
                        )}
                        <span className="pick-systems muted">{(item.documents ?? []).join(' · ')}</span>
                      </label>
                    </li>
                  )
                })
              )}
            </ul>
          </section>

          <section className="from-saved-preview" aria-label="What the new profile starts with" aria-live="polite">
            <h4>The new profile starts with</h4>
            {picked.length === 0 ? (
              <p className="muted">Nothing picked yet.</p>
            ) : (
              <>
                <ol className="picked-order">
                  {picked.map((profile, index) => (
                    <li key={profile.id}>
                      <span className="picked-name">{profile.name}</span>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={index === 0}
                        aria-label={`Move ${profile.name} earlier`}
                        title="Move earlier"
                        onClick={() => move(index, -1)}
                      >
                        ↑
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={index === picked.length - 1}
                        aria-label={`Move ${profile.name} later`}
                        title="Move later"
                        onClick={() => move(index, 1)}
                      >
                        ↓
                      </button>
                    </li>
                  ))}
                </ol>

                {combined && catalog && (
                  <dl className="combine-summary">
                    {catalog.groups.map((group) => {
                      const fragment = catalog.fragments.find((item) => item.id === combined.selection[group.id])
                      return (
                        <div className="combine-row" key={group.id}>
                          <dt>{group.label}</dt>
                          <dd>
                            {fragment ? (
                              <>
                                {fragment.name} <span className="muted">from {combined.from[group.id]}</span>
                              </>
                            ) : (
                              <span className="muted">none</span>
                            )}
                          </dd>
                        </div>
                      )
                    })}
                  </dl>
                )}

                {/* Overlaps are expected, not a mistake: worth knowing, so the calm style, not the warning. */}
                {combined?.overlaps.length > 0 && (
                  <div className="notice notice-info">
                    <p>Where they overlap, the later pick is used:</p>
                    <ul>
                      {combined.overlaps.map((overlap) => (
                        <li key={`${overlap.kind}-${overlap.key}`}>{describeOverlap(overlap)}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {combined?.cleared.length > 0 && (
                  <p className="muted">Left empty for the new profile’s own: {combined.cleared.join(', ')}.</p>
                )}
                {combined?.skipped.length > 0 && (
                  <p className="notice">
                    No templates were found behind {combined.skipped.join(', ')}, so{' '}
                    {combined.skipped.length === 1 ? 'it adds' : 'they add'} nothing.
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </Dialog>
  )
}

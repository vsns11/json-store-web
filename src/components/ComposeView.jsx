import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client.js'
import { byteSize, formatBytes } from '../lib/json.js'
import { composeDocument, defaultValues, fieldCards, fieldsFor, missingFields } from '../lib/template.js'
import { useToasts } from '../hooks/useToasts.jsx'
import FormField from './FormField.jsx'
import { Icon } from './Icons.jsx'
import JsonTree from './JsonTree.jsx'
import TagEditor from './TagEditor.jsx'

const NONE = ''

/** The composed profile, shown on demand rather than taking up half the screen. */
function PreviewDialog({ composed, size, onClose }) {
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

/**
 * Builds one large document out of the small templates in the catalogue: pick a fragment per
 * group, fill in the handful of fields they ask for, and the merged result is what gets stored.
 */
export default function ComposeView({ onBack, onCreated }) {
  const toasts = useToasts()
  const [catalog, setCatalog] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [selection, setSelection] = useState({})
  const [values, setValues] = useState({})
  const [meta, setMeta] = useState({ name: '', description: '', tags: [] })
  const [nameEdited, setNameEdited] = useState(false)
  const [saving, setSaving] = useState(false)
  const [previewing, setPreviewing] = useState(false)

  useEffect(() => {
    api
      .templates()
      .then((loaded) => {
        setCatalog(loaded)
        const first = loaded.groups.find((group) => group.required)
        const base = loaded.fragments.find((fragment) => fragment.group === first?.id)
        setSelection(base ? { [first.id]: base.id } : {})
      })
      .catch((failure) => setLoadError(failure.message))
  }, [])

  const fields = useMemo(() => (catalog ? fieldsFor(catalog, selection) : []), [catalog, selection])
  const cards = useMemo(() => (catalog ? fieldCards(catalog, selection) : []), [catalog, selection])

  // Keep values for fields that are still on screen, and defaults for the ones just added.
  useEffect(() => {
    setValues((current) => defaultValues(fields, current))
  }, [fields])

  const composed = useMemo(
    () => (catalog ? composeDocument(catalog, selection, values) : {}),
    [catalog, selection, values],
  )
  const serialized = JSON.stringify(composed, null, 2)
  const missing = missingFields(fields, values)
  const mergedCount = Object.values(selection).filter(Boolean).length

  // The document name follows the service name until someone types their own.
  const name = nameEdited ? meta.name : String(values.serviceName ?? meta.name ?? '')

  if (loadError) {
    return (
      <section className="panel">
        <div className="table-message">
          <p className="muted">{loadError}</p>
          <button className="btn btn-sm" onClick={onBack}>
            Back
          </button>
        </div>
      </section>
    )
  }

  if (!catalog) {
    return (
      <section className="panel">
        <div className="table-message">
          <span className="spinner" />
        </div>
      </section>
    )
  }

  const create = async () => {
    if (!name.trim()) {
      toasts.error('Give the document a name before saving')
      return
    }
    if (missing.length > 0) {
      toasts.error(`${missing[0].label} is required`)
      return
    }
    setSaving(true)
    try {
      const saved = await api.create({
        name: name.trim(),
        description: meta.description.trim() || null,
        tags: meta.tags,
        payload: composed,
      })
      toasts.success(`Stored “${saved.name}”`)
      onCreated(saved)
    } catch (failure) {
      toasts.error(failure.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="panel">
      <header className="editor-header">
        <div className="header-row">
          <button className="btn btn-ghost back-button" onClick={onBack} title="Back to all documents">
            <Icon.Back /> All profiles
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              className="title-input"
              value={name}
              placeholder="Name this scenario"
              maxLength={120}
              onChange={(event) => {
                setNameEdited(true)
                setMeta({ ...meta, name: event.target.value })
              }}
            />
            <input
              className="description-input"
              value={meta.description}
              placeholder="What this scenario covers…"
              maxLength={500}
              onChange={(event) => setMeta({ ...meta, description: event.target.value })}
            />
          </div>
        </div>
        <TagEditor tags={meta.tags} onChange={(tags) => setMeta({ ...meta, tags })} />
      </header>

      <div className="compose-body">
        <section className="compose-section">
          <h3 className="compose-heading">Templates</h3>
          <div className="compose-grid">
          {catalog.groups.map((group) => {
            const options = catalog.fragments.filter((fragment) => fragment.group === group.id)
            const chosen = catalog.fragments.find((fragment) => fragment.id === selection[group.id])
            return (
              <label className="compose-field" key={group.id}>
                <span className="compose-label">
                  {group.label}
                  {group.required && <em> required</em>}
                </span>
                <select
                  className="input"
                  value={selection[group.id] ?? NONE}
                  onChange={(event) => setSelection({ ...selection, [group.id]: event.target.value })}
                >
                  {!group.required && <option value={NONE}>— none —</option>}
                  {options.map((fragment) => (
                    <option key={fragment.id} value={fragment.id}>
                      {fragment.name}
                    </option>
                  ))}
                </select>
                {chosen?.description && <span className="compose-help">{chosen.description}</span>}
              </label>
            )
          })}
          </div>
        </section>

        {cards.map((card) => (
          <section className="card" key={card.id}>
            <header className="card-head">
              <h4>{card.name}</h4>
              {card.description && <span className="card-note">{card.description}</span>}
            </header>

            <div className="compose-grid card-body">
              {card.fields.map((field) => (
                <FormField
                  key={field.key}
                  field={field}
                  value={values[field.key]}
                  invalid={missing.some((item) => item.key === field.key)}
                  onChange={(next) => setValues((current) => ({ ...current, [field.key]: next }))}
                />
              ))}
            </div>
          </section>
        ))}

        {cards.length === 0 && <p className="muted compose-empty">Pick a template to see its fields.</p>}
      </div>

      <footer className="statusbar">
        <span className="status-pill is-valid">
          <span className="status-dot" /> {mergedCount} template{mergedCount === 1 ? '' : 's'} merged
        </span>
        {missing.length > 0 && <span className="status-error">{missing.map((field) => field.label).join(', ')} required</span>}
        <div className="status-actions">
          <span className="muted">{formatBytes(byteSize(serialized))}</span>
          <button className="btn btn-sm" onClick={() => setPreviewing(true)}>
            <Icon.Eye /> Preview
          </button>
          <button className="btn btn-sm btn-primary" onClick={create} disabled={saving || missing.length > 0}>
            {saving ? <span className="spinner" /> : <Icon.Save />} Save profile
          </button>
        </div>
      </footer>

      {previewing && (
        <PreviewDialog composed={composed} size={byteSize(serialized)} onClose={() => setPreviewing(false)} />
      )}
    </section>
  )
}

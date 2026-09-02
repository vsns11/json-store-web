import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client.js'
import { byteSize, formatBytes } from '../lib/json.js'
import { composeDocument, defaultValues, fieldsFor, missingFields } from '../lib/template.js'
import { useToasts } from '../hooks/useToasts.jsx'
import { Icon } from './Icons.jsx'
import JsonTree from './JsonTree.jsx'
import TagEditor from './TagEditor.jsx'

const NONE = ''

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
            <Icon.Back /> All documents
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              className="title-input"
              value={name}
              placeholder="Untitled document"
              maxLength={120}
              onChange={(event) => {
                setNameEdited(true)
                setMeta({ ...meta, name: event.target.value })
              }}
            />
            <input
              className="description-input"
              value={meta.description}
              placeholder="Add a short description…"
              maxLength={500}
              onChange={(event) => setMeta({ ...meta, description: event.target.value })}
            />
          </div>
        </div>
        <TagEditor tags={meta.tags} onChange={(tags) => setMeta({ ...meta, tags })} />
      </header>

      <div className="compose-body">
        <div className="compose-form">
          <h3 className="compose-heading">Templates</h3>
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

          <h3 className="compose-heading">Values</h3>
          {fields.length === 0 && <p className="muted form-hint">Pick a template to see its fields.</p>}

          {fields.map((field) => (
            <label className="compose-field" key={field.key}>
              <span className="compose-label">
                {field.label}
                {field.required && <em> required</em>}
                <small>{field.fragment}</small>
              </span>

              {field.type === 'select' ? (
                <select
                  className="input"
                  value={values[field.key] ?? ''}
                  onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
                >
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : field.type === 'boolean' ? (
                <select
                  className="input"
                  value={String(values[field.key] ?? false)}
                  onChange={(event) => setValues({ ...values, [field.key]: event.target.value === 'true' })}
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : (
                <input
                  className={`input${field.required && !String(values[field.key] ?? '').trim() ? ' is-invalid' : ''}`}
                  value={values[field.key] ?? ''}
                  inputMode={field.type === 'number' ? 'decimal' : undefined}
                  onChange={(event) => {
                    const raw = event.target.value
                    const parsed = field.type === 'number' && raw.trim() !== '' && !Number.isNaN(Number(raw))
                      ? Number(raw)
                      : raw
                    setValues({ ...values, [field.key]: parsed })
                  }}
                />
              )}
            </label>
          ))}
        </div>

        <div className="compose-preview">
          <div className="compose-preview-head">
            <span>Composed document</span>
            <span className="muted">{formatBytes(byteSize(serialized))}</span>
          </div>
          <JsonTree value={composed} />
        </div>
      </div>

      <footer className="statusbar">
        <span className="status-pill is-valid">
          <span className="status-dot" /> {mergedCount} template{mergedCount === 1 ? '' : 's'} merged
        </span>
        {missing.length > 0 && <span className="status-error">{missing.map((field) => field.label).join(', ')} required</span>}
        <div className="status-actions">
          <button className="btn btn-sm btn-primary" onClick={create} disabled={saving || missing.length > 0}>
            {saving ? <span className="spinner" /> : <Icon.Save />} Save to Postgres
          </button>
        </div>
      </footer>
    </section>
  )
}

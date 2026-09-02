import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client.js'
import { byteSize, formatBytes } from '../lib/json.js'
import { compose, fieldCards, fieldsFor, missingFields } from '../lib/template.js'
import { useToasts } from '../hooks/useToasts.jsx'
import FormField from './FormField.jsx'
import { Icon } from './Icons.jsx'
import PreviewDialog from './PreviewDialog.jsx'
import TagEditor from './TagEditor.jsx'
import TemplateForm from './TemplateForm.jsx'

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
  const composed = useMemo(() => (catalog ? compose(catalog, selection, values).payload : {}), [catalog, selection, values])

  const selectFragment = (nextSelection) => {
    const result = compose(catalog, nextSelection, values)
    setSelection(nextSelection)
    setValues(result.values)
  }
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
        template: { selection, values },
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
        <TemplateForm
          catalog={catalog}
          selection={selection}
          values={values}
          cards={cards}
          invalidKeys={missing.map((field) => field.key)}
          onSelect={selectFragment}
          onValue={(key, next) => setValues({ ...values, [key]: next })}
        />
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

import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client.js'
import {
  SAMPLE_PROFILE,
  byteSize,
  describeShape,
  formatJson,
  minifyJson,
  parseJson,
  sortJsonKeys,
} from '../lib/json.js'
import { downloadJson, readJsonFile } from '../lib/files.js'
import { compose, fieldCards, fieldsFor, missingFields } from '../lib/template.js'
import { useToasts } from '../hooks/useToasts.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import { Icon } from './Icons.jsx'
import EditorToolbar from './EditorToolbar.jsx'
import JsonEditor from './JsonEditor.jsx'
import JsonTree from './JsonTree.jsx'
import TemplateForm from './TemplateForm.jsx'
import StatusBar from './StatusBar.jsx'
import TagEditor from './TagEditor.jsx'

const snapshot = (draft) => JSON.stringify(draft)

/**
 * Edits one document. Mounted with a key of the document id, so switching
 * documents always starts from a clean draft.
 */
export default function ProfileEditor({ document: saved, onSaved, onDeleted, onBack }) {
  const isNew = !saved
  const toasts = useToasts()
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)

  const [draft, setDraft] = useState(() => ({
    name: saved?.name ?? '',
    description: saved?.description ?? '',
    tags: saved?.tags ?? [],
    text: saved ? JSON.stringify(saved.payload, null, 2) : '',
  }))
  const [baseline, setBaseline] = useState(() => snapshot(draft))
  // A profile composed from templates remembers its selection, and can be edited as that form again.
  const [template, setTemplate] = useState(saved?.template ?? null)
  const [catalog, setCatalog] = useState(null)
  const [view, setView] = useState(saved?.template ? 'form' : 'code')
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [dragging, setDragging] = useState(false)

  // The catalogue is only needed by the form, so it is fetched when there is one to draw.
  useEffect(() => {
    if (!template || catalog) return
    api.templates().then(setCatalog).catch((failure) => toasts.error(failure.message))
  }, [template, catalog]) // eslint-disable-line react-hooks/exhaustive-deps

  const parsed = useMemo(() => parseJson(draft.text), [draft.text])
  const shape = useMemo(() => (parsed.ok ? describeShape(parsed.value) : null), [parsed])
  const dirty = snapshot(draft) !== baseline
  // The tree needs something that parses; anything else falls back to the editor.
  const effectiveView = view === 'form' && template ? 'form' : view === 'tree' && parsed.ok ? 'tree' : 'code'

  const cards = useMemo(
    () => (catalog && template ? fieldCards(catalog, template.selection) : []),
    [catalog, template],
  )
  const missing = useMemo(
    () => (catalog && template ? missingFields(fieldsFor(catalog, template.selection), template.values) : []),
    [catalog, template],
  )

  // jsonb does not preserve key order, so the comparison has to ignore it.
  const matchesTemplate = useMemo(() => {
    if (!catalog || !template || !parsed.ok) return true
    const fromTemplate = JSON.stringify(compose(catalog, template.selection, template.values).payload, null, 2)
    return sortJsonKeys(fromTemplate).text === sortJsonKeys(draft.text).text
  }, [catalog, template, parsed.ok, draft.text])

  /** Any change in the form rebuilds the inputs from the template. */
  const recompose = (selection, values) => {
    const result = compose(catalog, selection, values)
    setTemplate({ selection, values: result.values })
    patch({ text: JSON.stringify(result.payload, null, 2) })
  }

  const patch = (changes) => setDraft((current) => ({ ...current, ...changes }))

  const transform = (transformer) => {
    const result = transformer(draft.text)
    if (result.ok) {
      patch({ text: result.text })
    } else {
      toasts.error(`Cannot reformat: ${result.error.message}`)
    }
  }

  const save = async () => {
    const parsedNow = parseJson(draft.text)
    if (!parsedNow.ok) {
      toasts.error(`Fix the JSON first — line ${parsedNow.error.line}: ${parsedNow.error.message}`)
      return
    }
    if (!draft.name.trim()) {
      toasts.error('Give the document a name before saving')
      return
    }

    setSaving(true)
    try {
      const body = {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        tags: draft.tags,
        payload: parsedNow.value,
        template,
      }
      const result = isNew ? await api.create(body) : await api.update(saved.id, body)
      setBaseline(snapshot(draft))
      toasts.success(isNew ? `Stored “${result.name}”` : `Saved “${result.name}”`)
      onSaved(result)
    } catch (error) {
      toasts.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    setConfirmingDelete(false)
    try {
      await api.remove(saved.id)
      toasts.success(`Deleted “${saved.name}”`)
      onDeleted()
    } catch (error) {
      toasts.error(error.message)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft.text)
      toasts.info('JSON copied to clipboard')
    } catch {
      toasts.error('The browser blocked clipboard access')
    }
  }

  const loadFile = async (file) => {
    if (!file) return
    const { name, text } = await readJsonFile(file)
    const formatted = formatJson(text)
    patch({ text: formatted.ok ? formatted.text : text, name: draft.name || name })
    toasts[formatted.ok ? 'info' : 'error'](
      formatted.ok ? `Loaded ${file.name}` : `Loaded ${file.name}, but it is not valid JSON`,
    )
  }

  const jumpToError = () => {
    const position = parsed.error?.position
    const input = textareaRef.current
    if (position == null || !input) return
    input.focus()
    input.setSelectionRange(position, position + 1)
  }

  // Keyboard shortcuts read the latest handlers through a ref, so the listener is bound once.
  const latest = useRef({})
  latest.current = { save, format: () => transform(formatJson) }
  useEffect(() => {
    const onKeyDown = (event) => {
      if (!(event.metaKey || event.ctrlKey)) return
      const key = event.key.toLowerCase()
      if (key === 's') {
        event.preventDefault()
        latest.current.save()
      } else if (key === 'f' && event.shiftKey) {
        event.preventDefault()
        latest.current.format()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

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
              value={draft.name}
              placeholder="Name this scenario"
              maxLength={120}
              onChange={(event) => patch({ name: event.target.value })}
            />
            <input
              className="description-input"
              value={draft.description}
              placeholder="What this scenario covers…"
              maxLength={500}
              onChange={(event) => patch({ description: event.target.value })}
            />
          </div>
        </div>
        <TagEditor tags={draft.tags} onChange={(tags) => patch({ tags })} />
      </header>

      <EditorToolbar
        view={effectiveView}
        onViewChange={setView}
        canFormat={parsed.ok}
        canUseForm={Boolean(template)}
        onFormat={() => transform(formatJson)}
        onMinify={() => transform(minifyJson)}
        onSortKeys={() => transform(sortJsonKeys)}
        onCopy={copy}
        onDownload={() => downloadJson(draft.name, draft.text)}
        onUpload={() => fileInputRef.current?.click()}
        onSample={() => patch({ text: SAMPLE_PROFILE })}
      />

      <div
        className="editor-body"
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          loadFile(event.dataTransfer.files[0])
        }}
      >
        {effectiveView === 'form' ? (
          catalog ? (
            <div className="compose-body">
              {!matchesTemplate && (
                <p className="notice">
                  These inputs have been edited by hand since they were composed. Changing a field here
                  rebuilds them from the templates, and those edits will be lost.
                </p>
              )}
              <TemplateForm
                catalog={catalog}
                selection={template.selection}
                values={template.values}
                cards={cards}
                invalidKeys={missing.map((field) => field.key)}
                showPickers={false}
                onValue={(key, value) => recompose(template.selection, { ...template.values, [key]: value })}
              />
            </div>
          ) : (
            <div className="table-message">
              <span className="spinner" />
            </div>
          )
        ) : effectiveView === 'tree' ? (
          <JsonTree value={parsed.value} />
        ) : (
          <JsonEditor
            value={draft.text}
            onChange={(text) => patch({ text })}
            errorLine={parsed.ok || parsed.empty ? null : parsed.error.line}
            textareaRef={textareaRef}
          />
        )}
        {dragging && <div className="drop-target">Drop a .json file to load it</div>}
      </div>

      <StatusBar
        parsed={parsed}
        shape={shape}
        // The stored size is the minified payload, which is what the profile list shows too.
        size={parsed.ok ? byteSize(JSON.stringify(parsed.value)) : byteSize(draft.text)}
        dirty={dirty}
        saving={saving}
        isNew={isNew}
        onSave={save}
        onRevert={() => {
          setDraft(JSON.parse(baseline))
          toasts.info('Reverted to the last saved version')
        }}
        onDelete={() => setConfirmingDelete(true)}
        onJumpToError={jumpToError}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => {
          loadFile(event.target.files[0])
          event.target.value = ''
        }}
      />

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete profile"
          message={`“${saved.name}” will be deleted. This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={remove}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </section>
  )
}

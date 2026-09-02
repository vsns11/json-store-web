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
import { useToasts } from '../hooks/useToasts.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import { Icon } from './Icons.jsx'
import EditorToolbar from './EditorToolbar.jsx'
import JsonEditor from './JsonEditor.jsx'
import JsonTree from './JsonTree.jsx'
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
  const [view, setView] = useState('code')
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [dragging, setDragging] = useState(false)

  const parsed = useMemo(() => parseJson(draft.text), [draft.text])
  const shape = useMemo(() => (parsed.ok ? describeShape(parsed.value) : null), [parsed])
  const dirty = snapshot(draft) !== baseline
  // The tree needs something that parses; anything else falls back to the editor.
  const effectiveView = view === 'tree' && parsed.ok ? 'tree' : 'code'

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
        {effectiveView === 'tree' ? (
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

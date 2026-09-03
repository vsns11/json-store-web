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
import {
  DEFAULT_DOCUMENT,
  invalidDocuments,
  nextDocumentName,
  renameDocument,
  sortByName,
  toPayload,
  toTexts,
} from '../lib/documents.js'
import { downloadJson, readJsonFile } from '../lib/files.js'
import { loadCatalog } from '../lib/catalog.js'
import { compose, fieldCards, fieldsFor, missingFields } from '../lib/template.js'
import { inferTemplate } from '../lib/templateMatch.js'
import { useToasts } from '../hooks/useToasts.jsx'
import CompareDialog from './CompareDialog.jsx'
import DocumentTabs from './DocumentTabs.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import EditorToolbar from './EditorToolbar.jsx'
import JsonEditor from './JsonEditor.jsx'
import JsonTree from './JsonTree.jsx'
import ProfileHeader from './ProfileHeader.jsx'
import TemplateForm from './TemplateForm.jsx'
import StatusBar from './StatusBar.jsx'

const snapshot = (draft) => JSON.stringify(draft)

/** A new profile starts with no templates chosen; picking one fills in the inputs. */
const EMPTY_TEMPLATE = { selection: {}, values: {} }

const hasSelection = (template) => Object.values(template?.selection ?? {}).some(Boolean)

/**
 * Which of the three tabs can actually be drawn. The form is always available — without a template
 * behind it, it offers the pickers — but the tree needs inputs that parse.
 */
function chooseView(chosen, parses) {
  if (chosen === 'form') return 'form'
  if (chosen === 'tree' && parses) return 'tree'
  return 'code'
}

/**
 * Edits one document. Mounted with a key of the document id, so switching
 * documents always starts from a clean draft.
 */
export default function ProfileEditor({ document: saved, onSaved, onDeleted, onBack, onDirtyChange }) {
  const toasts = useToasts()
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)

  const [draft, setDraft] = useState(() => ({
    name: saved?.name ?? '',
    description: saved?.description ?? '',
    tags: saved?.tags ?? [],
    // One document per system this profile feeds, held as text while it is being edited.
    documents: toTexts(saved?.payload),
  }))
  const [active, setActive] = useState(() => Object.keys(toTexts(saved?.payload))[0])
  const [baseline, setBaseline] = useState(() => snapshot(draft))
  // A profile composed from templates remembers its selection, and can be edited as that form again.
  // Older ones do not, so their selection is worked out from the inputs instead.
  const isNew = !saved
  const [template, setTemplate] = useState(saved?.template ?? EMPTY_TEMPLATE)
  const [inferred, setInferred] = useState(false)
  const [catalog, setCatalog] = useState(null)
  const [view, setView] = useState(isNew || saved?.template ? 'form' : 'code')
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [comparing, setComparing] = useState(false)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    loadCatalog()
      .then((loaded) => {
        setCatalog(loaded)
        if (saved && !saved.template) {
          const match = inferTemplate(loaded, saved.payload)
          if (match) {
            setTemplate(match)
            setInferred(true)
            setView('form')
          }
        }
      })
      .catch((failure) => toasts.error(failure.message))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const names = Object.keys(draft.documents)
  const text = draft.documents[active] ?? ''
  const invalid = useMemo(() => invalidDocuments(draft.documents), [draft.documents])
  const parsed = useMemo(() => parseJson(text), [text])
  const shape = useMemo(() => (parsed.ok ? describeShape(parsed.value) : null), [parsed])
  const dirty = snapshot(draft) !== baseline
  // The tree needs something that parses; anything else falls back to the editor.
  const effectiveView = chooseView(view, parsed.ok)
  // A profile is governed by templates once something is picked; until then the form offers them.
  const governed = hasSelection(template)

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
    if (!catalog || !hasSelection(template)) return true
    if (invalid.length > 0) return true
    const fromTemplate = JSON.stringify(compose(catalog, template.selection, template.values).payload)
    return sortJsonKeys(fromTemplate).text === sortJsonKeys(JSON.stringify(toPayload(draft.documents))).text
  }, [catalog, template, invalid.length, draft.documents])

  /** Any change in the form rebuilds the inputs from the template. */
  const recompose = (selection, values) => {
    const result = compose(catalog, selection, values)
    setTemplate({ selection, values: result.values })

    const documents = Object.fromEntries(
      Object.entries(result.payload).map(([name, value]) => [name, JSON.stringify(value, null, 2)]),
    )
    const changes = { documents: sortByName(documents) }
    // A new profile takes its name from the scenario until someone types their own.
    if (isNew && !draft.name.trim() && result.values.scenarioName) {
      changes.name = String(result.values.scenarioName)
    }
    patch(changes)
    if (!(active in changes.documents)) setActive(Object.keys(changes.documents)[0] ?? DEFAULT_DOCUMENT)
  }

  const patch = (changes) => setDraft((current) => ({ ...current, ...changes }))

  /** Everything that edits JSON edits the document currently on screen. */
  const patchText = (next) =>
    setDraft((current) => ({ ...current, documents: { ...current.documents, [active]: next } }))

  const transform = (transformer) => {
    const result = transformer(text)
    if (result.ok) {
      patchText(result.text)
    } else {
      toasts.error(`Cannot reformat: ${result.error.message}`)
    }
  }

  const save = async () => {
    if (invalid.length > 0) {
      toasts.error(`Fix the JSON in “${invalid[0]}” first`)
      setActive(invalid[0])
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
        payload: toPayload(draft.documents),
        template: hasSelection(template) ? template : null,
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
      await navigator.clipboard.writeText(text)
      toasts.info('JSON copied to clipboard')
    } catch {
      toasts.error('The browser blocked clipboard access')
    }
  }

  const loadFile = async (file) => {
    if (!file) return
    const { name, text: contents } = await readJsonFile(file)
    const formatted = formatJson(contents)
    patchText(formatted.ok ? formatted.text : contents)
    if (!draft.name) patch({ name })
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

  // Anything that navigates away needs to know there is unsaved work to warn about.
  useEffect(() => {
    onDirtyChange?.(dirty)
    return () => onDirtyChange?.(false)
  }, [dirty, onDirtyChange])

  // Keyboard shortcuts read the latest handlers through a ref, so the listener is bound once.
  const latest = useRef({})
  latest.current = { save, format: () => transform(formatJson), back: onBack }
  useEffect(() => {
    const onKeyDown = (event) => {
      // Esc goes back to the table, unless a dialog is open and wants it first.
      if (event.key === 'Escape' && !window.document.querySelector('.overlay')) {
        latest.current.back?.()
        return
      }
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
      <ProfileHeader
        name={draft.name}
        description={draft.description}
        tags={draft.tags}
        onChange={patch}
        onBack={onBack}
      />

      <EditorToolbar
        view={effectiveView}
        onViewChange={setView}
        canFormat={parsed.ok}
        onFormat={() => transform(formatJson)}
        onMinify={() => transform(minifyJson)}
        onSortKeys={() => transform(sortJsonKeys)}
        onCopy={copy}
        onDownload={() => downloadJson(`${draft.name}-${active}`, text)}
        onUpload={() => fileInputRef.current?.click()}
        onSample={() => patchText(SAMPLE_PROFILE)}
        onCompare={saved && invalid.length === 0 ? () => setComparing(true) : null}
      />

      {effectiveView !== 'form' && (
        <DocumentTabs
          names={names}
          active={active}
          invalid={invalid}
          onSelect={setActive}
          onAdd={() => {
            const name = nextDocumentName(draft.documents)
            patch({ documents: sortByName({ ...draft.documents, [name]: '{}' }) })
            setActive(name)
          }}
          onRename={(from, to) => {
            patch({ documents: renameDocument(draft.documents, from, to) })
            setActive(to)
          }}
          onRemove={(name) => {
            const { [name]: removed, ...rest } = draft.documents
            patch({ documents: rest })
            setActive(Object.keys(rest)[0])
          }}
        />
      )}

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
            <div className="template-form">
              {governed && inferred ? (
                <p className="notice notice-info">
                  This profile was saved before its templates were recorded, so the fields below were
                  matched to the inputs. Changing one rebuilds the inputs from the templates — which may
                  add fields the templates define — and saving records the match.
                </p>
              ) : governed ? (
                !matchesTemplate && (
                  <p className="notice">
                    These inputs have been edited by hand since they were composed. Changing a field here
                    rebuilds them from the templates, and those edits will be lost.
                  </p>
                )
              ) : (
                !isNew && (
                  <p className="notice">
                    This profile was written by hand. Picking a template below rebuilds its inputs from
                    that template, replacing what is there now — the Editor tab keeps them as they are.
                  </p>
                )
              )}
              <TemplateForm
                catalog={catalog}
                selection={template.selection}
                values={template.values}
                cards={cards}
                invalidKeys={missing.map((field) => field.key)}
                showPickers={!governed}
                onSelect={(selection) => recompose(selection, template.values)}
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
            value={text}
            onChange={patchText}
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
        size={parsed.ok ? byteSize(JSON.stringify(parsed.value)) : byteSize(text)}
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

      {comparing && (
        <CompareDialog
          current={{ id: saved.id, name: draft.name, payload: toPayload(draft.documents) }}
          onClose={() => setComparing(false)}
        />
      )}

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

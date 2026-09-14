import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, OVERWRITE } from '../api/client.js'
import { byteSize, describeShape, parseJson, sortJsonKeys } from '../lib/json.js'
import { DEFAULT_DOCUMENT, invalidDocuments, sortByName, toPayload, toTexts } from '../lib/documents.js'
import { downloadJson } from '../lib/files.js'
import { loadCatalog } from '../lib/catalog.js'
import { compose, fieldCards, fieldsFor, missingFields } from '../lib/template.js'
import { inferTemplate } from '../lib/templateMatch.js'
import { useToasts } from '../hooks/useToasts.jsx'
import CompareDialog from './CompareDialog.jsx'
import DocumentTabs from './DocumentTabs.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import Dialog from './Dialog.jsx'
import EditorToolbar from './EditorToolbar.jsx'
import JsonTree from './JsonTree.jsx'
import ProfileHeader from './ProfileHeader.jsx'
import TemplateForm from './TemplateForm.jsx'
import StatusBar from './StatusBar.jsx'

const snapshot = (draft) => JSON.stringify(draft)

/** A new profile starts with no templates chosen; picking one fills in the inputs. */
const EMPTY_TEMPLATE = { selection: {}, values: {} }

const hasSelection = (template) => Object.values(template?.selection ?? {}).some(Boolean)

/**
 * Which of the two tabs can be drawn. The form is where inputs come from, so it is always
 * available; the tree only has something to show once the form has built the inputs.
 */
function chooseView(chosen, built) {
  return chosen === 'tree' && built ? 'tree' : 'form'
}

/** The editable form of a stored profile: its details plus one document per system. */
function draftOf(profile) {
  return {
    name: profile?.name ?? '',
    description: profile?.description ?? '',
    tags: profile?.tags ?? [],
    // One document per system this profile feeds, held as text so the tree and the size
    // counts read exactly what will be stored.
    documents: toTexts(profile?.payload),
  }
}

/** Composed documents as text, or a single empty one when the selection builds nothing. */
function textsOf(payload) {
  const entries = Object.entries(payload)
  if (entries.length === 0) return { [DEFAULT_DOCUMENT]: '' }
  return sortByName(Object.fromEntries(entries.map(([name, value]) => [name, JSON.stringify(value, null, 2)])))
}

/**
 * Edits one profile. Mounted with a key, so opening another profile always
 * starts from a clean draft.
 *
 * Inputs come from the template form and nowhere else. The tree beside it is a read-only view of
 * what the form has built, so a profile's inputs can always be traced back to a template and the
 * fields that were typed into it.
 */
export default function ProfileEditor({ profile: opened, canDelete, onSaved, onDeleted, onBack, onDirtyChange }) {
  const toasts = useToasts()
  // The profile as the server last stored it. Saving a new profile fills this in, so the editor
  // carries on editing what it just created rather than creating it again.
  const [saved, setSaved] = useState(opened)
  const [reloading, setReloading] = useState(false)

  const [draft, setDraft] = useState(() => draftOf(opened))
  const [chosen, setChosen] = useState(() => Object.keys(toTexts(opened?.payload))[0])
  const [baseline, setBaseline] = useState(() => snapshot(draft))
  // The templates the baseline was composed from, so reverting puts the form back too.
  const baselineTemplate = useRef(opened?.template ?? EMPTY_TEMPLATE)
  // A profile composed from templates remembers its selection, and can be edited as that form again.
  // Older ones do not, so their selection is worked out from the inputs instead.
  const isNew = !saved
  const [template, setTemplate] = useState(opened?.template ?? EMPTY_TEMPLATE)
  const [inferred, setInferred] = useState(false)
  const [catalog, setCatalog] = useState(null)
  const [catalogError, setCatalogError] = useState(null)
  const [view, setView] = useState('form')
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  // Set when a save was refused because someone else saved first: what the API said happened.
  const [conflict, setConflict] = useState(null)
  const [comparing, setComparing] = useState(false)
  // One line in the status bar saying what just happened. It replaces itself and then clears,
  // so routine confirmations never pile up the way a stack of pop-ups does.
  const [note, setNote] = useState(null)
  const noteTimer = useRef(null)

  const flash = useCallback((message) => {
    setNote(message)
    clearTimeout(noteTimer.current)
    noteTimer.current = setTimeout(() => setNote(null), 4000)
  }, [])

  useEffect(() => () => clearTimeout(noteTimer.current), [])

  /**
   * The catalogue is the only way inputs are written, so failing to load it leaves nothing to do
   * on this screen. It says so in the page and offers the retry, rather than spinning forever —
   * `loadCatalog` drops its cached promise on failure, so trying again really does refetch.
   */
  const fetchCatalog = useCallback(() => {
    setCatalogError(null)
    loadCatalog()
      .then((loaded) => {
        setCatalog(loaded)
        if (opened && !opened.template) {
          const match = inferTemplate(loaded, opened.payload)
          if (match) {
            setTemplate(match)
            baselineTemplate.current = match
            setInferred(true)
          }
        }
      })
      .catch((failure) => setCatalogError(failure.message))
  }, [opened])

  useEffect(() => {
    fetchCatalog()
  }, [fetchCatalog])

  const names = Object.keys(draft.documents)
  // The document on screen: the one picked, unless the form has since rebuilt the set without it.
  const active = chosen in draft.documents ? chosen : names[0]
  const text = draft.documents[active] ?? ''
  // Documents the form has not built yet. Nothing can be edited by hand any more, so the only way
  // one holds nothing usable is that no template has filled it in.
  const unbuilt = useMemo(() => invalidDocuments(draft.documents), [draft.documents])
  const parsed = useMemo(() => parseJson(text), [text])
  const shape = useMemo(() => (parsed.ok ? describeShape(parsed.value) : null), [parsed])
  const dirty = snapshot(draft) !== baseline
  const effectiveView = chooseView(view, parsed.ok)
  // An existing profile is governed by templates once it has a selection; its pickers are then
  // settled and hidden. While creating one, they stay on screen so the rest can be chosen.
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
    const fromTemplate = JSON.stringify(compose(catalog, template.selection, template.values).payload)
    return sortJsonKeys(fromTemplate).text === sortJsonKeys(JSON.stringify(toPayload(draft.documents))).text
  }, [catalog, template, draft.documents])

  const patch = (changes) => setDraft((current) => ({ ...current, ...changes }))

  /** Any change in the form rebuilds the inputs from the template. */
  const recompose = (selection, values) => {
    const result = compose(catalog, selection, values)
    setTemplate({ selection, values: result.values })

    const changes = { documents: textsOf(result.payload) }
    // A new profile takes its name from the scenario until someone types their own.
    if (isNew && !draft.name.trim() && result.values.scenarioName) {
      changes.name = String(result.values.scenarioName)
    }
    patch(changes)
    if (!(active in changes.documents)) setChosen(Object.keys(changes.documents)[0])
  }

  /** Saves the version that was loaded; with `overwrite`, replaces whatever is stored instead. */
  const save = async ({ overwrite = false } = {}) => {
    if (!draft.name.trim()) {
      toasts.error('Give the profile a name before saving')
      return
    }
    if (unbuilt.length > 0) {
      toasts.error('Pick a template to build the inputs before saving')
      setView('form')
      return
    }
    if (missing.length > 0) {
      toasts.error(`Fill in “${missing[0].label}” first — the template needs it`)
      setView('form')
      return
    }

    setSaving(true)
    try {
      // The server builds the inputs from the template itself; the tree here is only a preview. A
      // profile with no templates sends none, which keeps its stored inputs and changes the details.
      const body = {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        tags: draft.tags,
        template: governed ? template : null,
      }
      const result = isNew
        ? await api.create(body)
        : await api.update(saved.id, body, overwrite ? OVERWRITE : saved.version)
      // What was stored is what the server built, so the editor adopts it rather than its own preview.
      const stored = draftOf(result)
      setSaved(result)
      setDraft(stored)
      setBaseline(snapshot(stored))
      setTemplate(result.template ?? EMPTY_TEMPLATE)
      if (!(active in stored.documents)) setChosen(Object.keys(stored.documents)[0])
      baselineTemplate.current = result.template ?? EMPTY_TEMPLATE
      setInferred(false)
      flash(isNew ? 'Saved' : 'Saved your changes')
      onSaved(result)
    } catch (error) {
      if (error.status === 412) {
        setConflict(error.message)
        return
      }
      // Refused inputs name each field; the first one says what to fix, and the form is where to fix it.
      if (error.status === 422) setView('form')
      toasts.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  /** Throws away local edits and loads the profile as it is stored. */
  const reload = async () => {
    setReloading(true)
    try {
      const stored = await api.get(saved.id)
      const fresh = draftOf(stored)
      setSaved(stored)
      setDraft(fresh)
      setBaseline(snapshot(fresh))
      setTemplate(stored.template ?? EMPTY_TEMPLATE)
      baselineTemplate.current = stored.template ?? EMPTY_TEMPLATE
      setInferred(false)
      setChosen(Object.keys(fresh.documents)[0])
      flash('Loaded the stored version')
    } catch (failure) {
      toasts.error(failure.message)
    } finally {
      setReloading(false)
    }
  }

  const remove = async () => {
    setConfirmingDelete(false)
    try {
      await api.remove(saved.id, saved.version)
      toasts.success(`Deleted “${saved.name}”`)
      onDeleted()
    } catch (error) {
      toasts.error(error.status === 412 ? `${error.message}. Reload to see the change before deleting it.` : error.message)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      flash(`Copied “${active}” to the clipboard`)
    } catch {
      toasts.error('The browser blocked clipboard access')
    }
  }

  // Anything that navigates away needs to know there is unsaved work to warn about.
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  // Closing the editor always leaves the app with nothing outstanding.
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])

  // Keyboard shortcuts read the latest handlers through a ref, so the listener is bound once
  // instead of being torn down and rebuilt on every keystroke.
  const latest = useRef({})
  useEffect(() => {
    latest.current = { save, back: onBack }
  })

  useEffect(() => {
    const onKeyDown = (event) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)
      // Esc goes back to the table — but not out from under someone typing, and not while a
      // dialog is open, since the dialog wants it first.
      if (event.key === 'Escape' && !typing && !window.document.querySelector('.overlay')) {
        latest.current.back?.()
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        latest.current.save()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <section className="panel" aria-label={isNew ? 'New profile' : `Profile ${saved.name}`}>
      <ProfileHeader
        name={draft.name}
        description={draft.description}
        tags={draft.tags}
        onChange={patch}
        onBack={onBack}
      />

      <EditorToolbar
        view={effectiveView}
        active={active}
        onViewChange={setView}
        canBrowse={parsed.ok}
        onCopy={copy}
        onDownload={parsed.ok ? () => downloadJson(`${draft.name}-${active}`, text) : null}
        onCompare={saved && unbuilt.length === 0 ? () => setComparing(true) : null}
      />

      {effectiveView === 'tree' && <DocumentTabs names={names} active={active} onSelect={setChosen} />}

      <div className="editor-body">
        {effectiveView === 'tree' ? (
          <JsonTree value={parsed.value} />
        ) : catalog ? (
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
                  These inputs were changed outside this form since they were composed. Changing a field
                  here rebuilds them from the templates, and those changes will be lost.
                </p>
              )
            ) : (
              !isNew && (
                <p className="notice">
                  This profile was not built from a template, so there are no fields to show. Picking one
                  below rebuilds its inputs from that template, replacing what is stored now — the Tree
                  tab shows what that is.
                </p>
              )
            )}
            <TemplateForm
              catalog={catalog}
              selection={template.selection}
              values={template.values}
              cards={cards}
              invalidKeys={missing.map((field) => field.key)}
              showPickers={isNew || !governed}
              onSelect={(selection) => recompose(selection, template.values)}
              onValue={(key, value) => recompose(template.selection, { ...template.values, [key]: value })}
            />
          </div>
        ) : catalogError ? (
          <div className="table-message">
            <p className="muted">The templates could not be loaded, so there is nothing to fill in. {catalogError}</p>
            <button className="btn btn-sm" onClick={fetchCatalog}>
              Try again
            </button>
          </div>
        ) : (
          <div className="table-message" aria-busy="true">
            <span className="spinner" />
          </div>
        )}
      </div>

      <StatusBar
        built={parsed.ok}
        shape={shape}
        // The stored size is the minified payload, which is what the profile list shows too.
        size={parsed.ok ? byteSize(JSON.stringify(parsed.value)) : null}
        dirty={dirty}
        saving={saving}
        isNew={isNew}
        canDelete={canDelete}
        savedAt={saved?.updatedAt}
        savedBy={saved?.updatedBy}
        note={note}
        reloading={reloading}
        onReload={saved ? reload : null}
        onSave={save}
        onRevert={() => {
          setDraft(JSON.parse(baseline))
          setTemplate(baselineTemplate.current)
          flash('Went back to the last saved version')
        }}
        onDelete={() => setConfirmingDelete(true)}
      />

      {comparing && (
        <CompareDialog
          current={{ id: saved.id, name: draft.name, payload: toPayload(draft.documents) }}
          onClose={() => setComparing(false)}
        />
      )}

      {conflict && (
        <Dialog
          title="Saved by someone else first"
          onClose={() => setConflict(null)}
          actions={
            <>
              <button className="btn" onClick={() => setConflict(null)}>
                Cancel
              </button>
              <button
                className="btn"
                onClick={() => {
                  setConflict(null)
                  reload()
                }}
                autoFocus
              >
                Load their version
              </button>
              <button
                className="btn btn-danger-solid"
                onClick={() => {
                  setConflict(null)
                  save({ overwrite: true })
                }}
              >
                Overwrite with mine
              </button>
            </>
          }
        >
          <p>{conflict}.</p>
          <p className="muted">
            Loading their version discards your unsaved changes here. Overwriting replaces what they saved.
          </p>
        </Dialog>
      )}

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete profile"
          message={`“${saved.name}” will be deleted. This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={remove}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </section>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, OVERWRITE } from '../api/client.js'
import { byteSize, describeShape, parseJson, sortJsonKeys } from '../lib/json.js'
import { DEFAULT_DOCUMENT, invalidDocuments, sortByName, toPayload, toTexts } from '../lib/documents.js'
import { downloadJson } from '../lib/files.js'
import { loadCatalog } from '../lib/catalog.js'
import { compose, fieldCards, fieldProblems, fieldsFor, groupProblems, unknownTemplates } from '../lib/template.js'
import { inferTemplate } from '../lib/templateMatch.js'
import { combineProfiles, describeOverlap } from '../lib/combine.js'
import { useToasts } from '../hooks/useToasts.jsx'
import CompareDialog from './CompareDialog.jsx'
import DocumentTabs from './DocumentTabs.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import Dialog from './Dialog.jsx'
import EditorToolbar from './EditorToolbar.jsx'
import { Icon } from './Icons.jsx'
import JsonTree from './JsonTree.jsx'
import ProfileHeader from './ProfileHeader.jsx'
import TemplateForm from './TemplateForm.jsx'
import StatusBar from './StatusBar.jsx'

const snapshot = (draft) => JSON.stringify(draft)

/** A viewer's copy never changes, so there is never unsaved work to warn about. */
const ignoreChange = () => {}

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

/** A field the API refused, keyed the way the form keys its own problems. */
function issueFromServer({ field, message }) {
  if (field.startsWith('template.values.')) return { key: field.slice('template.values.'.length), message }
  if (field.startsWith('template.selection.')) return { key: `group:${field.slice('template.selection.'.length)}`, message }
  return { key: field, message }
}

/**
 * The details a profile started from saved ones opens with. One source is a copy and keeps its
 * description; several are named after all of them and bring every tag. The inputs are filled in
 * once the catalogue has loaded and the templates can be combined.
 */
function draftFromSources(sources) {
  if (sources.length === 1) return { ...draftOf(sources[0]), name: `${sources[0].name} (copy)` }
  return {
    ...draftOf(null),
    name: sources.map((source) => source.name).join(' + '),
    tags: [...new Set(sources.flatMap((source) => source.tags ?? []))].slice(0, 12),
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
export default function ProfileEditor({
  profile: opened,
  sources = null,
  onStartFromSaved = null,
  canEdit = true,
  canDelete,
  onSaved,
  onDeleted,
  onBack,
  onDirtyChange,
}) {
  const toasts = useToasts()
  // The profile as the server last stored it. Saving a new profile fills this in, so the editor
  // carries on editing what it just created rather than creating it again.
  const [saved, setSaved] = useState(opened)
  const [reloading, setReloading] = useState(false)

  const [draft, setDraft] = useState(() => (sources ? draftFromSources(sources) : draftOf(opened)))
  const [chosen, setChosen] = useState(() => Object.keys(toTexts((sources?.[0] ?? opened)?.payload))[0])
  // A profile started from saved ones has never been saved itself, so it opens as unsaved work.
  const [baseline, setBaseline] = useState(() => snapshot(sources ? draftOf(null) : draft))
  // The templates the baseline was composed from, so reverting puts the form back too.
  const baselineTemplate = useRef(opened?.template ?? EMPTY_TEMPLATE)
  // A profile composed from templates remembers its selection, and can be edited as that form again.
  // Older ones do not, so their selection is worked out from the inputs instead.
  const isNew = !saved
  const [template, setTemplate] = useState(
    (sources?.length === 1 ? sources[0].template : opened?.template) ?? EMPTY_TEMPLATE,
  )
  // What combining the saved profiles found — overlaps, identifiers left empty — for the notice.
  const [combined, setCombined] = useState(null)
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
        if (sources?.length) {
          // A copy of one, or several combined: each brings its templates and values, and fields the
          // catalogue gives an example rather than a default start empty for this profile's own.
          const result = combineProfiles(loaded, sources)
          setCombined(result)
          if (Object.values(result.selection).some(Boolean)) {
            setTemplate({ selection: result.selection, values: result.values })
            setDraft((current) => ({ ...current, documents: textsOf(result.payload) }))
          }
        }
        // A profile made with another catalogue has no fields here, so it opens on what it holds.
        if (unknownTemplates(loaded, opened?.template?.selection).length > 0) setView('tree')
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
  }, [opened, sources])

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
  // Templates this profile was made with that the catalogue in use does not have.
  const foreign = useMemo(() => unknownTemplates(catalog, template.selection), [catalog, template])
  const fits = foreign.length === 0

  const cards = useMemo(
    () => (catalog && template ? fieldCards(catalog, template.selection) : []),
    [catalog, template],
  )
  // What would stop a save, by the rules the server checks: required groups first, then fields. A
  // profile that was never built from templates has none, because saving it changes only its details.
  const checked = isNew || (governed && fits)
  const problems = useMemo(
    () =>
      catalog && checked
        ? [
            ...groupProblems(catalog, template.selection),
            ...fieldProblems(fieldsFor(catalog, template.selection), template.values),
          ]
        : [],
    [catalog, checked, template],
  )
  // A fresh form is not shouted at: its own problems are shown once a save has been tried. What the
  // server refused is shown straight away, and stays until the form changes.
  const [attempted, setAttempted] = useState(false)
  const [serverIssues, setServerIssues] = useState([])
  const [summarySignal, setSummarySignal] = useState(0)
  const shown = useMemo(() => {
    const byKey = new Map(serverIssues.map((issue) => [issue.key, issue]))
    if (attempted) problems.forEach((problem) => byKey.set(problem.key, problem))
    return [...byKey.values()]
  }, [attempted, problems, serverIssues])
  const errors = useMemo(() => Object.fromEntries(shown.map((problem) => [problem.key, problem.message])), [shown])

  const showProblems = () => {
    setAttempted(true)
    setView('form')
    setSummarySignal((signal) => signal + 1)
  }
  const clearProblems = () => {
    setAttempted(false)
    setServerIssues([])
  }

  // jsonb does not preserve key order, so the comparison has to ignore it.
  const matchesTemplate = useMemo(() => {
    if (!catalog || !hasSelection(template) || !fits) return true
    const fromTemplate = JSON.stringify(compose(catalog, template.selection, template.values).payload)
    return sortJsonKeys(fromTemplate).text === sortJsonKeys(JSON.stringify(toPayload(draft.documents))).text
  }, [catalog, template, fits, draft.documents])

  const patch = (changes) => setDraft((current) => ({ ...current, ...changes }))

  /** Any change in the form rebuilds the inputs from the template. */
  const recompose = (selection, values) => {
    setServerIssues([])
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
    if (problems.length > 0) {
      showProblems()
      return
    }
    if (unbuilt.length > 0) {
      toasts.error('Pick a template to build the inputs before saving')
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
        // A profile made with another catalogue cannot be rebuilt here, so saving changes only its details.
        template: governed && fits ? template : null,
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
      clearProblems()
      flash(isNew ? 'Saved' : 'Saved your changes')
      onSaved(result)
    } catch (error) {
      if (error.status === 412) {
        setConflict(error.message)
        return
      }
      // Refused inputs name each field, and the form is where to fix them, so they are listed there.
      if (error.status === 422 && error.fieldErrors.length > 0) {
        setServerIssues(error.fieldErrors.map(issueFromServer))
        showProblems()
        return
      }
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
      clearProblems()
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

  return (
    <section className="panel" aria-label={isNew ? 'New profile' : `Profile ${saved.name}`}>
      <ProfileHeader
        name={draft.name}
        description={draft.description}
        tags={draft.tags}
        onChange={canEdit ? patch : ignoreChange}
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
            {isNew && canEdit && onStartFromSaved && (
              <div className="from-saved-start">
                <button className="btn btn-sm" onClick={onStartFromSaved}>
                  <Icon.Copy /> Start from saved profiles…
                </button>
                <span className="muted">Use the templates and values of one or more profiles already saved.</span>
              </div>
            )}
            {sources && isNew && (
              <div className="notice notice-info">
                <p>
                  {sources.length === 1
                    ? `A copy of “${sources[0].name}”, not saved yet.`
                    : `Combined from ${sources.map((source) => `“${source.name}”`).join(', ')}, not saved yet.`}{' '}
                  Fields that identify one particular thing start empty, ready for this one’s own.
                </p>
                {combined?.overlaps.length > 0 && (
                  <>
                    <p>Where they overlap, the later one is used:</p>
                    <ul>
                      {combined.overlaps.map((overlap) => (
                        <li key={`${overlap.kind}-${overlap.key}`}>{describeOverlap(overlap)}</li>
                      ))}
                    </ul>
                  </>
                )}
                {combined?.skipped.length > 0 && (
                  <p>No templates were found behind {combined.skipped.join(', ')}, so nothing was taken from them.</p>
                )}
              </div>
            )}
            {!canEdit && (
              <p className="notice notice-info">
                You can look at this profile, but changing it needs editor access. Ask your administrator if you
                should have it.
              </p>
            )}
            {!fits ? (
              <div className="notice notice-info">
                <p>
                  This profile was made with templates the catalogue in use does not have:{' '}
                  {foreign.map((item) => `${item.group} “${item.template}”`).join(', ')}. It was most likely saved while
                  the API was serving a different catalogue.
                </p>
                <p>
                  Its inputs are kept exactly as stored, and the Tree tab shows them. Its name, description and tags
                  can still be changed. To build it again with this catalogue, start a new profile.
                </p>
              </div>
            ) : governed && inferred ? (
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
            {/* disabled on a fieldset disables every control inside it, however deeply nested. */}
            {fits && (
              <fieldset className="form-fieldset" disabled={!canEdit}>
              <TemplateForm
                catalog={catalog}
                selection={template.selection}
                values={template.values}
                cards={cards}
                errors={errors}
                summary={shown}
                summarySignal={summarySignal}
                // A settled profile hides its pickers, unless a required group is the thing to fix.
                showPickers={isNew || !governed || problems.some((problem) => problem.key.startsWith('group:'))}
                onSelect={(selection) => recompose(selection, template.values)}
                onValue={(key, value) => recompose(template.selection, { ...template.values, [key]: value })}
              />
            </fieldset>
            )}
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
        onSave={canEdit ? save : null}
        onRevert={() => {
          setDraft(JSON.parse(baseline))
          setTemplate(baselineTemplate.current)
          clearProblems()
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

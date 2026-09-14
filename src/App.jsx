import { useEffect, useRef, useState } from 'react'
import { api } from './api/client.js'
import ConfirmDialog from './components/ConfirmDialog.jsx'
import ProfileEditor from './components/ProfileEditor.jsx'
import ProfileTable from './components/ProfileTable.jsx'
import LoginScreen from './components/LoginScreen.jsx'
import FromSavedDialog from './components/FromSavedDialog.jsx'
import TopBar from './components/TopBar.jsx'
import Sidebar from './components/Sidebar.jsx'
import Toasts from './components/Toasts.jsx'
import { useAuth } from './hooks/useAuth.jsx'
import { useProfiles } from './hooks/useProfiles.js'
import { useToasts } from './hooks/useToasts.jsx'
import { APP_NAME } from './config.js'

// What the signed-in account may do, from the roles the API gave it at sign-in. The API enforces the
// same rules; these only keep the screen from offering what would be refused. Roles nest, so an admin
// also carries EDITOR and VIEWER.
const mayEdit = (user) => Boolean(user?.roles?.includes('EDITOR'))
const mayDelete = (user) => Boolean(user?.roles?.includes('ADMIN'))

/**
 * Which sidebar entry is highlighted. Editing an existing profile is reached from the table rather
 * than the rail, so nothing is marked then.
 */
function railSelection(view, selected) {
  if (view !== 'editor') return 'profiles'
  return selected ? '' : 'new'
}

/** The theme chosen last time, or the operating system's if there is no last time. */
function initialTheme() {
  const stored = localStorage.getItem('theme')
  if (stored === 'dark' || stored === 'light') return stored
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function App() {
  const { user, status, expired, signIn, signOut } = useAuth()
  const toasts = useToasts()
  const searchRef = useRef(null)
  const { query, update, page, stats, loading, error, refresh } = useProfiles(toasts.error, status === 'signed-in')

  const [view, setView] = useState('table') // 'table' while browsing, 'editor' while editing one
  const [selected, setSelected] = useState(null) // the open profile, or null for a new one
  const [editorKey, setEditorKey] = useState('new')
  // The saved profiles a new, unsaved one starts from — one for a duplicate, several combined — while
  // such a profile is open; otherwise null.
  const [draftSources, setDraftSources] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  // Open while saved profiles are being picked to start a new one from.
  const [pickingSaved, setPickingSaved] = useState(false)
  // Set while the editor holds unsaved work, so leaving can ask first.
  const [editorDirty, setEditorDirty] = useState(false)
  const [pendingLeave, setPendingLeave] = useState(null)
  const [theme, setTheme] = useState(initialTheme)
  const [sidebarExpanded, setSidebarExpanded] = useState(() => localStorage.getItem('sidebar') !== 'collapsed')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('sidebar', sidebarExpanded ? 'expanded' : 'collapsed')
  }, [sidebarExpanded])

  // The tab title says where you are, and marks unsaved work the way editors do.
  useEffect(() => {
    if (view === 'editor') {
      const name = selected?.name ?? 'New profile'
      document.title = `${editorDirty ? '• ' : ''}${name} · ${APP_NAME}`
    } else {
      document.title = APP_NAME
    }
    return () => {
      document.title = APP_NAME
    }
  }, [view, selected, editorDirty])

  // Closing the tab with unsaved work gets the browser's own warning.
  useEffect(() => {
    if (!editorDirty) return undefined
    const warn = (event) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [editorDirty])

  /**
   * Runs an action that leaves the editor. With unsaved work it asks first and remembers what was
   * being attempted, so answering the question carries on where it left off.
   */
  const leaveEditor = (action) => {
    if (view === 'editor' && editorDirty) setPendingLeave(() => action)
    else action()
  }

  const showTable = () => {
    setEditorDirty(false)
    setView('table')
  }

  const openProfile = (id) => leaveEditor(() => loadProfile(id))

  const loadProfile = async (id) => {
    try {
      const profile = await api.get(id)
      setSelected(profile)
      setDraftSources(null)
      setEditorKey(profile.id)
      setView('editor')
    } catch (failure) {
      toasts.error(failure.message)
    }
  }

  const startNewProfile = () =>
    leaveEditor(() => {
      setSelected(null)
      setDraftSources(null)
      setEditorKey(`new-${Date.now()}`)
      setView('editor')
    })

  const showProfiles = () =>
    leaveEditor(() => {
      showTable()
      refresh()
    })

  /**
   * Signing out closes whatever was open. Otherwise the next person to sign in on this screen would land
   * in the last one's editor, looking at the profile as it was when that person opened it.
   */
  const signOutAndClose = () => {
    setEditorDirty(false)
    setSelected(null)
    setDraftSources(null)
    setPickingSaved(false)
    setView('table')
    signOut()
  }

  /** Typing a search always lands on the table; with unsaved work that is asked about first. */
  const search = (value) => {
    if (view === 'editor') {
      leaveEditor(() => {
        showTable()
        update({ search: value })
        // The box loses focus while the question is up; give it back so typing can carry on.
        requestAnimationFrame(() => searchRef.current?.focus())
      })
    } else {
      update({ search: value })
    }
  }

  /**
   * Opens a copy of a profile, templates and all, as a new profile that is not saved until someone
   * saves it. Duplicating used to save the copy at once, so a stray click left a twin in the store.
   */
  const duplicateProfile = (summary) => leaveEditor(() => copyProfile(summary))

  const copyProfile = async (summary) => {
    try {
      const original = await api.get(summary.id)
      openDraftFrom([original])
    } catch (failure) {
      toasts.error(failure.message)
    }
  }

  /** Opens a new, unsaved profile built from saved ones: a copy of one, or several combined. */
  const openDraftFrom = (profiles) => {
    setSelected(null)
    setDraftSources(profiles)
    setEditorKey(`from-${profiles.map((profile) => profile.id).join('-')}-${Date.now()}`)
    setView('editor')
  }

  /** The picked profiles open once any unsaved work on screen has been asked about. */
  const openPickedProfiles = (profiles) => {
    setPickingSaved(false)
    leaveEditor(() => openDraftFrom(profiles))
  }

  const deleteProfile = async () => {
    const target = pendingDelete
    setPendingDelete(null)
    try {
      await api.remove(target.id, target.version)
      toasts.success(`Deleted “${target.name}”`)
      if (selected?.id === target.id) setSelected(null)
      refresh()
    } catch (failure) {
      toasts.error(failure.status === 412 ? `${failure.message}. The list now shows the latest.` : failure.message)
      if (failure.status === 412) refresh()
    }
  }

  if (status === 'checking') {
    return (
      <div className="login" aria-busy="true">
        <span className="spinner" />
      </div>
    )
  }

  if (status === 'anonymous') {
    return (
      <>
        <LoginScreen onSignIn={signIn} expired={expired} />
        <Toasts />
      </>
    )
  }

  return (
    <div className="app">
      {/* The first thing a keyboard reaches, so the rail and the search box can be stepped over
          rather than tabbed through on every view change. Invisible until it has focus. */}
      <a className="skip-link" href="#content">
        Skip to content
      </a>

      <TopBar
        stats={stats}
        user={user}
        onSignOut={signOutAndClose}
        search={query.search}
        searchRef={searchRef}
        menuExpanded={sidebarExpanded}
        onToggleMenu={() => setSidebarExpanded(!sidebarExpanded)}
        onSearch={search}
      />

      <div className="workspace">
        <Sidebar
          expanded={sidebarExpanded}
          activeItem={railSelection(view, selected)}
          theme={theme}
          onShowProfiles={showProfiles}
          onNewProfile={mayEdit(user) ? startNewProfile : null}
          onRefresh={refresh}
          onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        />

        <main className="content" id="content" tabIndex={-1}>
          {view === 'table' ? (
            <ProfileTable
              query={query}
              onQueryChange={update}
              page={page}
              loading={loading}
              error={error}
              onRetry={refresh}
              onNew={mayEdit(user) ? startNewProfile : null}
              onNewFromSaved={mayEdit(user) ? () => setPickingSaved(true) : null}
              onOpen={openProfile}
              onDuplicate={mayEdit(user) ? duplicateProfile : null}
              onDelete={mayDelete(user) ? setPendingDelete : null}
            />
          ) : (
            <ProfileEditor
              key={editorKey}
              profile={selected}
              sources={draftSources}
              onStartFromSaved={mayEdit(user) ? () => setPickingSaved(true) : null}
              canEdit={mayEdit(user)}
              canDelete={mayDelete(user)}
              onDirtyChange={setEditorDirty}
              onBack={showProfiles}
              onSaved={(profile) => {
                // Stay on the profile that was just saved; only the list behind it needs refreshing.
                setEditorDirty(false)
                setSelected(profile)
                setDraftSources(null)
                refresh()
              }}
              onDeleted={() => {
                showTable()
                refresh()
              }}
            />
          )}
        </main>
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete profile"
          message={`The profile “${pendingDelete.name}” will be deleted. This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={deleteProfile}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {pendingLeave && (
        <ConfirmDialog
          title="Leave without saving?"
          message="This profile has changes that have not been saved. Leaving now discards them."
          confirmLabel="Discard changes"
          danger
          onConfirm={() => {
            const leave = pendingLeave
            setPendingLeave(null)
            setEditorDirty(false)
            leave()
          }}
          onCancel={() => setPendingLeave(null)}
        />
      )}

      {pickingSaved && <FromSavedDialog onClose={() => setPickingSaved(false)} onOpen={openPickedProfiles} />}

      {/* The session ran out mid-work: the app stays as it is, and signing in again carries on. */}
      {status === 'expired' && <LoginScreen onSignIn={signIn} expired overlay />}

      <Toasts />
    </div>
  )
}

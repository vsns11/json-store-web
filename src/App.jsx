import { useEffect, useRef, useState } from 'react'
import { api } from './api/client.js'
import ConfirmDialog from './components/ConfirmDialog.jsx'
import ProfileEditor from './components/ProfileEditor.jsx'
import ProfileTable from './components/ProfileTable.jsx'
import LoginScreen from './components/LoginScreen.jsx'
import ShortcutsDialog from './components/ShortcutsDialog.jsx'
import TopBar from './components/TopBar.jsx'
import Sidebar from './components/Sidebar.jsx'
import Toasts from './components/Toasts.jsx'
import { useAuth } from './hooks/useAuth.jsx'
import { useProfiles } from './hooks/useProfiles.js'
import { useToasts } from './hooks/useToasts.jsx'

/** Deleting is reserved for the admin group in the directory, the same rule the API enforces. */
const mayDelete = (user) => Boolean(user?.roles?.includes('ADMINS'))

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
  const [pendingDelete, setPendingDelete] = useState(null)
  const [showShortcuts, setShowShortcuts] = useState(false)
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
      document.title = `${editorDirty ? '• ' : ''}${name} · JSON Store`
    } else {
      document.title = 'JSON Store'
    }
    return () => {
      document.title = 'JSON Store'
    }
  }, [view, selected, editorDirty])

  // Closing the tab with unsaved work gets the browser's own warning.
  useEffect(() => {
    if (!editorDirty) return undefined
    const warn = (event) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [editorDirty])

  // The latest handlers, readable from listeners that are bound once.
  const latest = useRef({})

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

  latest.current = { leaveEditor, showTable }

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        latest.current.leaveEditor(() => {
          latest.current.showTable()
          searchRef.current?.focus()
        })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const openProfile = (id) => leaveEditor(() => loadProfile(id))

  const loadProfile = async (id) => {
    try {
      const profile = await api.get(id)
      setSelected(profile)
      setEditorKey(profile.id)
      setView('editor')
    } catch (failure) {
      toasts.error(failure.message)
    }
  }

  const startNewProfile = () =>
    leaveEditor(() => {
      setSelected(null)
      setEditorKey(`new-${Date.now()}`)
      setView('editor')
    })

  const showProfiles = () =>
    leaveEditor(() => {
      showTable()
      refresh()
    })

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

  /** Copies a profile, templates and all, and opens the copy ready to be adjusted. */
  const duplicateProfile = (summary) => leaveEditor(() => copyProfile(summary))

  const copyProfile = async (summary) => {
    try {
      const original = await api.get(summary.id)
      const copy = await api.create({
        name: `${original.name} (copy)`,
        description: original.description,
        tags: original.tags,
        payload: original.payload,
        template: original.template ?? null,
      })
      toasts.success(`Copied to “${copy.name}”`)
      refresh()
      setSelected(copy)
      setEditorKey(copy.id)
      setView('editor')
    } catch (failure) {
      toasts.error(failure.message)
    }
  }

  const deleteProfile = async () => {
    const target = pendingDelete
    setPendingDelete(null)
    try {
      await api.remove(target.id)
      toasts.success(`Deleted “${target.name}”`)
      if (selected?.id === target.id) setSelected(null)
      refresh()
    } catch (failure) {
      toasts.error(failure.message)
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
      <TopBar
        stats={stats}
        user={user}
        onSignOut={signOut}
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
          onNewProfile={startNewProfile}
          onRefresh={refresh}
          onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          onShowShortcuts={() => setShowShortcuts(true)}
        />

        <main className="content">
          {view === 'table' ? (
            <ProfileTable
              query={query}
              onQueryChange={update}
              page={page}
              loading={loading}
              error={error}
              onRetry={refresh}
              onNew={startNewProfile}
              onOpen={openProfile}
              onDuplicate={duplicateProfile}
              onDelete={mayDelete(user) ? setPendingDelete : null}
            />
          ) : (
            <ProfileEditor
              key={editorKey}
              profile={selected}
              canDelete={mayDelete(user)}
              onDirtyChange={setEditorDirty}
              onBack={showProfiles}
              onSaved={(profile) => {
                // Stay on the profile that was just saved; only the list behind it needs refreshing.
                setEditorDirty(false)
                setSelected(profile)
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

      {showShortcuts && <ShortcutsDialog onClose={() => setShowShortcuts(false)} />}

      {/* The session ran out mid-work: the app stays as it is, and signing in again carries on. */}
      {status === 'expired' && <LoginScreen onSignIn={signIn} expired overlay />}

      <Toasts />
    </div>
  )
}

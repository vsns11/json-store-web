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

/**
 * Which sidebar entry is highlighted. Editing an existing profile is reached from the table rather
 * than the rail, so nothing is marked then.
 */
function railSelection(view, selected) {
  if (view !== 'editor') return 'profiles'
  return selected ? '' : 'new'
}

export default function App() {
  const { user, status, signIn, signOut } = useAuth()
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
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') ?? 'light')
  const [sidebarExpanded, setSidebarExpanded] = useState(() => localStorage.getItem('sidebar') !== 'collapsed')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('sidebar', sidebarExpanded ? 'expanded' : 'collapsed')
  }, [sidebarExpanded])

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setView('table')
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

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
      setEditorDirty(false)
      setView('table')
      refresh()
    })

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
      showError(failure.message)
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
      <div className="login">
        <span className="spinner" />
      </div>
    )
  }

  if (status !== 'signed-in') {
    return (
      <>
        <LoginScreen onSignIn={signIn} />
        <Toasts />
      </>
    )
  }

  return (
    <div className="app">
      <TopBar
        stats={stats}
        search={query.search}
        searchRef={searchRef}
        menuExpanded={sidebarExpanded}
        onToggleMenu={() => setSidebarExpanded(!sidebarExpanded)}
        onSearch={(value) => {
          setView('table')
          update({ search: value })
        }}
        onNewProfile={startNewProfile}
      />

      <div className="workspace">
        <Sidebar
          expanded={sidebarExpanded}
          activeItem={railSelection(view, selected)}
          theme={theme}
          user={user}
          onShowProfiles={showProfiles}
          onNewProfile={startNewProfile}
          onRefresh={refresh}
          onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          onShowShortcuts={() => setShowShortcuts(true)}
          onSignOut={signOut}
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
              onDelete={setPendingDelete}
            />
          ) : (
            <ProfileEditor
              key={editorKey}
              document={selected}
              onDirtyChange={setEditorDirty}
              onBack={showProfiles}
              onSaved={() => {
                setEditorDirty(false)
                refresh()
                setView('table')
              }}
              onDeleted={() => {
                setEditorDirty(false)
                refresh()
                setView('table')
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
          onConfirm={deleteProfile}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {pendingLeave && (
        <ConfirmDialog
          title="Leave without saving?"
          message="This profile has changes that have not been saved. Leaving now discards them."
          confirmLabel="Discard changes"
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

      <Toasts />
    </div>
  )
}

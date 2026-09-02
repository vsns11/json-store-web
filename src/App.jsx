import { useEffect, useRef, useState } from 'react'
import { api } from './api/client.js'
import ComposeView from './components/ComposeView.jsx'
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

  const openProfile = async (id) => {
    try {
      const profile = await api.get(id)
      setSelected(profile)
      setEditorKey(profile.id)
      setView('editor')
    } catch (failure) {
      toasts.error(failure.message)
    }
  }

  const startNewProfile = () => {
    setSelected(null)
    setEditorKey(`new-${Date.now()}`)
    setView('editor')
  }

  const showProfiles = () => {
    setView('table')
    refresh()
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
          // Editing an existing profile is not one of the destinations in the rail.
          activeItem={view === 'editor' ? (selected ? '' : 'new') : view === 'compose' ? 'compose' : 'profiles'}
          theme={theme}
          user={user}
          onShowProfiles={showProfiles}
          onNewProfile={startNewProfile}
          onCompose={() => setView('compose')}
          onRefresh={refresh}
          onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          onShowShortcuts={() => setShowShortcuts(true)}
          onSignOut={signOut}
        />

        <main className="content">
          {view === 'compose' ? (
            <ComposeView
              onBack={showProfiles}
              onCreated={() => {
                refresh()
                setView('table')
              }}
            />
          ) : view === 'table' ? (
            <ProfileTable
              query={query}
              onQueryChange={update}
              page={page}
              loading={loading}
              error={error}
              onRetry={refresh}
              onOpen={openProfile}
              onDelete={setPendingDelete}
            />
          ) : (
            <ProfileEditor
              key={editorKey}
              document={selected}
              onBack={showProfiles}
              onSaved={() => {
                refresh()
                setView('table')
              }}
              onDeleted={() => {
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

      {showShortcuts && <ShortcutsDialog onClose={() => setShowShortcuts(false)} />}

      <Toasts />
    </div>
  )
}

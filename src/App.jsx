import { useEffect, useRef, useState } from 'react'
import { api } from './api/client.js'
import ConfirmDialog from './components/ConfirmDialog.jsx'
import DocumentEditor from './components/DocumentEditor.jsx'
import DocumentTable from './components/DocumentTable.jsx'
import { Icon } from './components/Icons.jsx'
import ShortcutsDialog from './components/ShortcutsDialog.jsx'
import Sidebar from './components/Sidebar.jsx'
import Toasts from './components/Toasts.jsx'
import { useDocuments } from './hooks/useDocuments.js'
import { useToasts } from './hooks/useToasts.jsx'
import { formatBytes, formatRelativeTime } from './lib/json.js'

export default function App() {
  const toasts = useToasts()
  const searchRef = useRef(null)
  const { query, update, page, stats, loading, error, refresh } = useDocuments(toasts.error)

  const [view, setView] = useState('table') // 'table' while browsing, 'editor' while editing one
  const [selected, setSelected] = useState(null) // the open document, or null for a new one
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

  const openDocument = async (id) => {
    try {
      const document = await api.get(id)
      setSelected(document)
      setEditorKey(document.id)
      setView('editor')
    } catch (failure) {
      toasts.error(failure.message)
    }
  }

  const startNewDocument = () => {
    setSelected(null)
    setEditorKey(`new-${Date.now()}`)
    setView('editor')
  }

  const showDocuments = () => {
    setView('table')
    refresh()
  }

  const deleteDocument = async () => {
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

  return (
    <div className="app">
      <header className="topbar">
        <button
          className="btn btn-ghost menu-trigger"
          onClick={() => setSidebarExpanded(!sidebarExpanded)}
          aria-expanded={sidebarExpanded}
          aria-label={sidebarExpanded ? 'Collapse menu' : 'Expand menu'}
        >
          <Icon.Menu />
        </button>

        <div className="brand">
          <span className="brand-mark">{'{}'}</span>
          <span>JSON Store</span>
        </div>

        <div className="topbar-stats">
          <span>
            Documents
            <b>{stats?.documents ?? '—'}</b>
          </span>
          <span>
            Stored
            <b>{formatBytes(stats?.totalBytes)}</b>
          </span>
          <span>
            Last write
            <b>{stats?.lastUpdatedAt ? formatRelativeTime(stats.lastUpdatedAt) : '—'}</b>
          </span>
        </div>

        <span className="topbar-spacer" />

        <div className="search">
          <Icon.Search className="search-icon" />
          <input
            ref={searchRef}
            className="input"
            value={query.search}
            placeholder="Search names, tags, JSON…"
            onChange={(event) => {
              setView('table')
              update({ search: event.target.value })
            }}
          />
          <span className="kbd">⌘K</span>
        </div>

        <button className="btn btn-primary" onClick={startNewDocument}>
          <Icon.Plus /> New document
        </button>
      </header>

      <div className="workspace">
        <Sidebar
          expanded={sidebarExpanded}
          view={view}
          theme={theme}
          onShowDocuments={showDocuments}
          onNewDocument={startNewDocument}
          onRefresh={refresh}
          onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          onShowShortcuts={() => setShowShortcuts(true)}
        />

        <main className="content">
          {view === 'table' ? (
            <DocumentTable
              query={query}
              onQueryChange={update}
              page={page}
              loading={loading}
              error={error}
              onRetry={refresh}
              onOpen={openDocument}
              onDelete={setPendingDelete}
            />
          ) : (
            <DocumentEditor
              key={editorKey}
              document={selected}
              onBack={showDocuments}
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
          title="Delete document"
          message={`“${pendingDelete.name}” will be removed from PostgreSQL. This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={deleteDocument}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {showShortcuts && <ShortcutsDialog onClose={() => setShowShortcuts(false)} />}

      <Toasts />
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { api } from './api/client.js'
import DocumentEditor from './components/DocumentEditor.jsx'
import DocumentList from './components/DocumentList.jsx'
import Toasts from './components/Toasts.jsx'
import { Icon } from './components/Icons.jsx'
import MainMenu from './components/MainMenu.jsx'
import ShortcutsDialog from './components/ShortcutsDialog.jsx'
import { useDocuments } from './hooks/useDocuments.js'
import { useToasts } from './hooks/useToasts.jsx'
import { formatBytes, formatRelativeTime } from './lib/json.js'

export default function App() {
  const { error: showError } = useToasts()
  const searchRef = useRef(null)
  const { query, update, page, stats, loading, error, refresh } = useDocuments(showError)

  const [selected, setSelected] = useState(null) // full document, or null for a new one
  const [editorKey, setEditorKey] = useState('new')
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') ?? 'light')
  const [showShortcuts, setShowShortcuts] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
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
    } catch (failure) {
      showError(failure.message)
    }
  }

  const startNewDocument = () => {
    setSelected(null)
    setEditorKey(`new-${Date.now()}`)
  }

  return (
    <div className="app">
      <header className="topbar">
        <MainMenu
          theme={theme}
          onNewDocument={startNewDocument}
          onRefresh={refresh}
          onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          onShowShortcuts={() => setShowShortcuts(true)}
        />

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
            onChange={(event) => update({ search: event.target.value })}
          />
          <span className="kbd">⌘K</span>
        </div>

        <button className="btn btn-ghost" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Toggle theme">
          {theme === 'dark' ? <Icon.Sun /> : <Icon.Moon />}
        </button>

        <button className="btn btn-primary" onClick={startNewDocument}>
          <Icon.Plus /> New document
        </button>
      </header>

      <main className="workspace">
        <DocumentList
          query={query}
          onQueryChange={update}
          page={page}
          loading={loading}
          error={error}
          onRetry={refresh}
          selectedId={selected?.id}
          onSelect={openDocument}
        />

        <DocumentEditor
          key={editorKey}
          document={selected}
          onSaved={(saved) => {
            setSelected(saved)
            setEditorKey(saved.id)
            refresh()
          }}
          onDeleted={() => {
            startNewDocument()
            refresh()
          }}
        />
      </main>

      {showShortcuts && <ShortcutsDialog onClose={() => setShowShortcuts(false)} />}

      <Toasts />
    </div>
  )
}

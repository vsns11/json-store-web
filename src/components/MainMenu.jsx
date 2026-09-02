import { useEffect, useRef, useState } from 'react'
import { API_BASE_URL, APP_VERSION } from '../config.js'
import { Icon } from './Icons.jsx'

/** The hamburger menu: actions that do not belong on the editor toolbar. */
export default function MainMenu({ theme, onNewDocument, onRefresh, onToggleTheme, onShowShortcuts }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const run = (action) => () => {
    setOpen(false)
    action()
  }

  return (
    <div className="menu" ref={containerRef}>
      <button
        className="btn btn-ghost menu-trigger"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Main menu"
      >
        <Icon.Menu />
      </button>

      {open && (
        <div className="menu-panel" role="menu">
          <button className="menu-item" role="menuitem" onClick={run(onNewDocument)}>
            <Icon.Plus /> New document
          </button>
          <button className="menu-item" role="menuitem" onClick={run(onRefresh)}>
            <Icon.Refresh /> Refresh list
          </button>
          <button className="menu-item" role="menuitem" onClick={run(onToggleTheme)}>
            {theme === 'dark' ? <Icon.Sun /> : <Icon.Moon />} {theme === 'dark' ? 'Light' : 'Dark'} theme
          </button>
          <button className="menu-item" role="menuitem" onClick={run(onShowShortcuts)}>
            <Icon.Keyboard /> Keyboard shortcuts
          </button>

          <div className="menu-separator" />

          <div className="menu-meta">
            <span>Version {APP_VERSION}</span>
            <span title={API_BASE_URL || window.location.origin}>API {API_BASE_URL || 'same origin'}</span>
          </div>
        </div>
      )}
    </div>
  )
}

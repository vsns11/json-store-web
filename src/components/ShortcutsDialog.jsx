import { useEffect } from 'react'

const SHORTCUTS = [
  ['⌘ / Ctrl + S', 'Save the open profile'],
  ['⌘ / Ctrl + ⇧ + F', 'Format the JSON'],
  ['⌘ / Ctrl + K', 'Focus the search box'],
  ['Tab', 'Indent inside the editor'],
  ['Enter', 'Commit a tag while typing one'],
  ['Esc', 'Close a dialog or the menu'],
]

export default function ShortcutsDialog({ onClose }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <h3>Keyboard shortcuts</h3>
        <dl className="shortcut-list">
          {SHORTCUTS.map(([keys, description]) => (
            <div key={keys} className="shortcut-row">
              <dt>
                <span className="kbd">{keys}</span>
              </dt>
              <dd>{description}</dd>
            </div>
          ))}
        </dl>
        <div className="dialog-actions">
          <button className="btn btn-primary" onClick={onClose} autoFocus>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

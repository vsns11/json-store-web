import Dialog from './Dialog.jsx'
import { shortcut } from '../lib/platform.js'

const SHORTCUTS = [
  [shortcut('S'), 'Save the open profile'],
  [shortcut('⇧', 'F'), 'Format the JSON'],
  [shortcut('K'), 'Focus the search box'],
  ['Tab / ⇧ Tab', 'Indent or outdent the line, or the selected lines'],
  ['Enter', 'New line at the same indent; deeper after { or ['],
  ['Enter or ,', 'Commit a tag while typing one'],
  ['Esc', 'Close a dialog, or go back to the profile list'],
]

export default function ShortcutsDialog({ onClose }) {
  return (
    <Dialog
      title="Keyboard shortcuts"
      onClose={onClose}
      actions={
        <button className="btn btn-primary" onClick={onClose} autoFocus>
          Close
        </button>
      }
    >
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
    </Dialog>
  )
}

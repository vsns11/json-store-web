import { useEffect, useState } from 'react'
import { Icon } from './Icons.jsx'

/**
 * One tab per system this profile feeds. The active tab's name is editable in place, the same way
 * a key is in the tree, so renaming needs no extra control.
 */
export default function DocumentTabs({ names, active, invalid, onSelect, onAdd, onRename, onRemove }) {
  return (
    <div className="doc-tabs">
      {names.map((name) =>
        name === active ? (
          <ActiveTab
            key={name}
            name={name}
            siblings={names.filter((other) => other !== name)}
            invalid={invalid.includes(name)}
            canRemove={names.length > 1}
            onRename={onRename}
            onRemove={onRemove}
          />
        ) : (
          <button key={name} className="doc-tab" onClick={() => onSelect(name)}>
            {invalid.includes(name) && <span className="doc-tab-warning" title="Not valid JSON" />}
            {name}
          </button>
        ),
      )}

      <button className="doc-tab doc-tab-add" onClick={onAdd} title="Add a document for another system">
        <Icon.Plus />
      </button>
    </div>
  )
}

function ActiveTab({ name, siblings, invalid, canRemove, onRename, onRemove }) {
  const [draft, setDraft] = useState(name)

  useEffect(() => setDraft(name), [name])

  const change = (next) => {
    setDraft(next)
    const trimmed = next.trim()
    if (trimmed && trimmed !== name && !siblings.includes(trimmed)) onRename(name, trimmed)
  }

  return (
    <span className="doc-tab is-active">
      {invalid && <span className="doc-tab-warning" title="Not valid JSON" />}
      <input
        className="doc-tab-name"
        value={draft}
        size={Math.max(draft.length, 4)}
        aria-label="Document name"
        onChange={(event) => change(event.target.value)}
        onBlur={() => setDraft(name)}
        onKeyDown={(event) => (event.key === 'Enter' || event.key === 'Escape') && event.target.blur()}
      />
      {canRemove && (
        <button className="doc-tab-remove" title={`Remove ${name}`} onClick={() => onRemove(name)}>
          ×
        </button>
      )}
    </span>
  )
}

import { useState } from 'react'

/** Read-only, collapsible view of a parsed payload. Branches deeper than two levels start collapsed. */
export default function JsonTree({ value }) {
  return (
    <div className="tree">
      <Node label={null} value={value} depth={0} isLast />
    </div>
  )
}

function Node({ label, value, depth, isLast }) {
  const [open, setOpen] = useState(depth < 2)
  const isArray = Array.isArray(value)
  const isObject = !isArray && value !== null && typeof value === 'object'

  if (!isArray && !isObject) {
    return (
      <div className="tree-row">
        <span className="tree-toggle" />
        <span>
          {label !== null && <span className="tree-key">"{label}": </span>}
          <Scalar value={value} />
          {!isLast && ','}
        </span>
      </div>
    )
  }

  const entries = isArray ? value.map((item, index) => [index, item]) : Object.entries(value)
  const [openBrace, closeBrace] = isArray ? ['[', ']'] : ['{', '}']
  const summary = `${entries.length} ${isArray ? 'item' : 'key'}${entries.length === 1 ? '' : 's'}`

  return (
    <div>
      <div className="tree-row">
        <button className="tree-toggle" onClick={() => setOpen(!open)} aria-label={open ? 'Collapse' : 'Expand'}>
          {open ? '▼' : '▶'}
        </button>
        <span>
          {label !== null && <span className="tree-key">"{label}": </span>}
          {openBrace}
          {!open && (
            <span className="tree-collapsed" onClick={() => setOpen(true)}>
              {' '}
              … {summary}{' '}
            </span>
          )}
          {!open && closeBrace}
          {!open && !isLast && ','}
        </span>
      </div>

      {open && (
        <>
          <div className="tree-children">
            {entries.map(([key, item], index) => (
              <Node
                key={key}
                label={isArray ? null : key}
                value={item}
                depth={depth + 1}
                isLast={index === entries.length - 1}
              />
            ))}
          </div>
          <div className="tree-row">
            <span className="tree-toggle" />
            <span>
              {closeBrace}
              {!isLast && ','}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

function Scalar({ value }) {
  if (value === null) return <span className="token-null">null</span>
  if (typeof value === 'string') return <span className="token-string">"{value}"</span>
  if (typeof value === 'number') return <span className="token-number">{value}</span>
  return <span className="token-boolean">{String(value)}</span>
}

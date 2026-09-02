import { useEffect, useRef, useState } from 'react'
import { flattenPaths, formatPath, parsePath, setAtPath } from '../lib/jsonPath.js'
import { Icon } from './Icons.jsx'

const TYPES = ['string', 'number', 'boolean', 'null', 'json']

let nextRowId = 0

const isContainer = (value) => value !== null && typeof value === 'object'

/** Describes a leaf value as the row that edits it. */
function toRow(path, value) {
  if (typeof value === 'string') return { id: ++nextRowId, path, type: 'string', draft: value }
  if (typeof value === 'number') return { id: ++nextRowId, path, type: 'number', draft: String(value) }
  if (typeof value === 'boolean') return { id: ++nextRowId, path, type: 'boolean', draft: String(value) }
  if (value === null) return { id: ++nextRowId, path, type: 'null', draft: '' }
  return { id: ++nextRowId, path, type: 'json', draft: JSON.stringify(value, null, 2) }
}

/** Rows for a document, or null when its root is a single value the form cannot lay out. */
function toRows(text, isEmpty) {
  if (isEmpty) return []
  try {
    const root = JSON.parse(text)
    if (!isContainer(root)) return null
    return flattenPaths(root).map((leaf) => toRow(leaf.path, leaf.value))
  } catch {
    return null
  }
}

function pathError(row) {
  if (!row.path.trim()) return 'Enter a path'
  try {
    parsePath(row.path)
    return null
  } catch (error) {
    return error.message
  }
}

function valueError(row) {
  if (row.type === 'number' && (row.draft.trim() === '' || Number.isNaN(Number(row.draft)))) {
    return 'Not a number'
  }
  if (row.type === 'json') {
    try {
      JSON.parse(row.draft)
    } catch {
      return 'Not valid JSON'
    }
  }
  return null
}

function rowValue(row) {
  switch (row.type) {
    case 'number':
      return Number(row.draft)
    case 'boolean':
      return row.draft === 'true'
    case 'null':
      return null
    case 'json':
      return JSON.parse(row.draft)
    default:
      return row.draft
  }
}

/**
 * Edits a document one JSON path at a time: every leaf of the template is a row, and a new row
 * writes its value into the path it names, creating whatever nesting that path implies.
 */
export default function FormEditor({ text, isEmpty, onChange }) {
  const [rows, setRows] = useState(() => toRows(text, isEmpty))
  const lastEmitted = useRef(text)

  // Re-read the rows when the JSON changed elsewhere (formatting, revert, another document).
  useEffect(() => {
    if (text !== lastEmitted.current) {
      setRows(toRows(text, isEmpty))
      lastEmitted.current = text
    }
  }, [text, isEmpty])

  if (rows === null) {
    return (
      <div className="empty">
        <div>
          <h2>This payload is a single value</h2>
          <p>
            The form edits documents built from objects and arrays. A bare string, number or boolean can
            still be edited on the Editor tab.
          </p>
        </div>
      </div>
    )
  }

  /** Rebuilds the whole document from the rows, so a renamed path just moves its value. */
  const commit = (nextRows) => {
    setRows(nextRows)

    const usable = nextRows.filter((row) => !pathError(row) && !valueError(row))
    const firstToken = usable.length ? parsePath(usable[0].path)[0] : null
    let root = typeof firstToken === 'number' ? [] : {}
    for (const row of usable) {
      root = setAtPath(root, parsePath(row.path), rowValue(row))
    }

    const serialized = JSON.stringify(root, null, 2)
    lastEmitted.current = serialized
    onChange(serialized)
  }

  const updateRow = (id, changes) =>
    commit(
      rows.map((row) => {
        if (row.id !== id) return row
        const next = { ...row, ...changes }
        // Switching type keeps whatever still makes sense and resets what does not.
        if (changes.type && changes.type !== row.type) {
          if (changes.type === 'boolean') next.draft = row.draft === 'true' ? 'true' : 'false'
          else if (changes.type === 'null') next.draft = ''
          else if (changes.type === 'json') next.draft = row.draft.trim().startsWith('{') ? row.draft : '{}'
          else if (changes.type === 'number') next.draft = Number.isNaN(Number(row.draft)) ? '0' : row.draft
        }
        return next
      }),
    )

  const addRow = () => {
    // Suggest the next sibling of the last row, so filling in a template is mostly typing values.
    const previous = rows.at(-1)
    let suggestion = ''
    if (previous && !pathError(previous)) {
      const tokens = parsePath(previous.path)
      suggestion = typeof tokens.at(-1) === 'number' ? formatPath([...tokens.slice(0, -1), tokens.at(-1) + 1]) : ''
    }
    commit([...rows, { id: ++nextRowId, path: suggestion, type: 'string', draft: '' }])
  }

  const duplicates = new Set(
    rows.map((row) => row.path.trim()).filter((path, index, all) => path && all.indexOf(path) !== index),
  )

  return (
    <div className="form-editor">
      <div className="form-grid form-head">
        <span>JSON path</span>
        <span>Type</span>
        <span>Value</span>
        <span />
      </div>

      {rows.length === 0 && (
        <p className="muted form-hint">
          Empty template. Add a path such as <code>owner.email</code> or <code>items[0].sku</code> and the
          objects and arrays around it are created for you.
        </p>
      )}

      {rows.map((row) => {
        const badPath = pathError(row)
        const badValue = valueError(row)
        const duplicate = duplicates.has(row.path.trim())
        return (
          <div className="form-grid form-row" key={row.id}>
            <div className="form-value">
              <input
                className={`input mono${badPath || duplicate ? ' is-invalid' : ''}`}
                value={row.path}
                placeholder="owner.email"
                spellCheck="false"
                onChange={(event) => updateRow(row.id, { path: event.target.value })}
              />
              {badPath && <span className="form-error">{badPath}</span>}
              {!badPath && duplicate && <span className="form-error">Duplicate path — the last one wins</span>}
            </div>

            <select className="input" value={row.type} onChange={(event) => updateRow(row.id, { type: event.target.value })}>
              {TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <div className="form-value">
              {row.type === 'boolean' ? (
                <select className="input" value={row.draft} onChange={(event) => updateRow(row.id, { draft: event.target.value })}>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : row.type === 'null' ? (
                <input className="input" value="null" disabled />
              ) : row.type === 'json' ? (
                <textarea
                  className={`input mono${badValue ? ' is-invalid' : ''}`}
                  rows={Math.min(8, row.draft.split('\n').length)}
                  value={row.draft}
                  spellCheck="false"
                  onChange={(event) => updateRow(row.id, { draft: event.target.value })}
                />
              ) : (
                <input
                  className={`input${badValue ? ' is-invalid' : ''}`}
                  value={row.draft}
                  inputMode={row.type === 'number' ? 'decimal' : undefined}
                  placeholder={row.type === 'number' ? '0' : 'value'}
                  onChange={(event) => updateRow(row.id, { draft: event.target.value })}
                />
              )}
              {badValue && <span className="form-error">{badValue}</span>}
            </div>

            <button
              className="btn btn-sm btn-danger"
              title="Remove this path"
              onClick={() => commit(rows.filter((item) => item.id !== row.id))}
            >
              <Icon.Trash />
            </button>
          </div>
        )
      })}

      <button className="btn btn-sm form-add" onClick={addRow}>
        <Icon.Plus /> Add path
      </button>
    </div>
  )
}

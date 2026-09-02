import { useEffect, useState } from 'react'
import { deleteAtPath, formatPath, setAtPath } from '../lib/jsonPath.js'
import { Icon } from './Icons.jsx'

const TYPES = ['string', 'number', 'boolean', 'null', 'object', 'array']

const isContainer = (value) => value !== null && typeof value === 'object'

function typeOf(value) {
  if (Array.isArray(value)) return 'array'
  if (value === null) return 'null'
  if (typeof value === 'object') return 'object'
  return typeof value
}

function emptyValue(type) {
  switch (type) {
    case 'number':
      return 0
    case 'boolean':
      return false
    case 'null':
      return null
    case 'object':
      return {}
    case 'array':
      return []
    default:
      return ''
  }
}

/** Converts a value to another type, keeping what carries over. */
function convert(value, type) {
  switch (type) {
    case 'string':
      return isContainer(value) ? '' : String(value ?? '')
    case 'number':
      return Number.isFinite(Number(value)) ? Number(value) : 0
    case 'boolean':
      return Boolean(value) && value !== 'false'
    default:
      return emptyValue(type)
  }
}

/** A blank copy of a value: same shape, emptied out — used when adding a row to a list. */
function blankLike(value) {
  if (Array.isArray(value)) return []
  if (isContainer(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, blankLike(item)]))
  }
  return emptyValue(typeOf(value))
}

function uniqueKey(object, base = 'newField') {
  if (!(base in object)) return base
  let index = 2
  while (`${base}${index}` in object) index += 1
  return `${base}${index}`
}

/**
 * Edits a document as a form: objects become sections, arrays become numbered lists, and
 * every value gets a labelled input. Nothing here needs the reader to write JSON.
 */
export default function FormEditor({ text, isEmpty, onChange }) {
  const root = isEmpty ? {} : safeParse(text)

  if (root === undefined || !isContainer(root)) {
    return (
      <div className="empty">
        <div>
          <h2>This payload is a single value</h2>
          <p>The form edits documents built from objects and lists. Use the Editor tab for a bare value.</p>
        </div>
      </div>
    )
  }

  const apply = (next) => onChange(JSON.stringify(next, null, 2))

  return (
    <div className="form-editor">
      <FormNode
        value={root}
        tokens={[]}
        label={null}
        onSet={(tokens, value) => apply(setAtPath(root, tokens, value))}
        onRemove={(tokens) => apply(deleteAtPath(root, tokens))}
        onRenameKey={(parentTokens, from, to) => {
          const parent = parentTokens.length === 0 ? root : getIn(root, parentTokens)
          const renamed = Object.fromEntries(
            Object.entries(parent).map(([key, item]) => [key === from ? to : key, item]),
          )
          apply(parentTokens.length === 0 ? renamed : setAtPath(root, parentTokens, renamed))
        }}
      />
    </div>
  )
}

function safeParse(text) {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function getIn(root, tokens) {
  return tokens.reduce((current, token) => current?.[token], root)
}

/** One node of the document: an object section, a list section, or a single field. */
function FormNode({ value, tokens, label, siblings, onSet, onRemove, onRenameKey, index }) {
  if (Array.isArray(value)) {
    return (
      <ListSection
        value={value}
        tokens={tokens}
        label={label}
        siblings={siblings}
        onSet={onSet}
        onRemove={onRemove}
        onRenameKey={onRenameKey}
        index={index}
      />
    )
  }
  if (isContainer(value)) {
    return (
      <ObjectSection
        value={value}
        tokens={tokens}
        label={label}
        siblings={siblings}
        onSet={onSet}
        onRemove={onRemove}
        onRenameKey={onRenameKey}
        index={index}
      />
    )
  }
  return (
    <Field
      value={value}
      tokens={tokens}
      label={label}
      siblings={siblings}
      onSet={onSet}
      onRemove={onRemove}
      onRenameKey={onRenameKey}
      index={index}
    />
  )
}

function ObjectSection({ value, tokens, label, siblings, onSet, onRemove, onRenameKey, index }) {
  const entries = Object.entries(value)
  const isRoot = tokens.length === 0

  return (
    <section className={isRoot ? 'form-root' : 'form-section'}>
      {!isRoot && (
        <SectionHeader
          label={label}
          index={index}
          tokens={tokens}
          siblings={siblings}
          type="object"
          count={`${entries.length} field${entries.length === 1 ? '' : 's'}`}
          onSet={onSet}
          onRemove={onRemove}
          onRenameKey={onRenameKey}
        />
      )}

      <div className={isRoot ? undefined : 'form-children'}>
        {entries.length === 0 && <p className="form-hint muted">No fields yet.</p>}

        {entries.map(([key, item], position) => (
          <FormNode
            key={position}
            value={item}
            label={key}
            siblings={entries.map(([name]) => name)}
            tokens={[...tokens, key]}
            onSet={onSet}
            onRemove={onRemove}
            onRenameKey={onRenameKey}
          />
        ))}

        <button
          className="btn btn-sm form-add"
          onClick={() => onSet([...tokens, uniqueKey(value)], '')}
        >
          <Icon.Plus /> Add field
        </button>
      </div>
    </section>
  )
}

function ListSection({ value, tokens, label, siblings, onSet, onRemove, onRenameKey, index }) {
  return (
    <section className="form-section">
      <SectionHeader
        label={label}
        index={index}
        tokens={tokens}
        siblings={siblings}
        type="array"
        count={`${value.length} item${value.length === 1 ? '' : 's'}`}
        onSet={onSet}
        onRemove={onRemove}
        onRenameKey={onRenameKey}
      />

      <div className="form-children">
        {value.length === 0 && <p className="form-hint muted">No items yet.</p>}

        {value.map((item, position) => (
          <FormNode
            key={position}
            value={item}
            label={null}
            index={position}
            tokens={[...tokens, position]}
            onSet={onSet}
            onRemove={onRemove}
            onRenameKey={onRenameKey}
          />
        ))}

        <button
          className="btn btn-sm form-add"
          // A new row copies the shape of the last one, so lists of objects stay consistent.
          onClick={() => onSet([...tokens, value.length], value.length ? blankLike(value.at(-1)) : '')}
        >
          <Icon.Plus /> Add item
        </button>
      </div>
    </section>
  )
}

function SectionHeader({ label, index, tokens, siblings, type, count, onSet, onRemove, onRenameKey }) {
  return (
    <header className="form-section-head" title={formatPath(tokens)}>
      {label === null ? (
        <span className="form-index">Item {index + 1}</span>
      ) : (
        <KeyLabel label={label} tokens={tokens} siblings={siblings} onRenameKey={onRenameKey} />
      )}
      <TypeSelect
        type={type}
        onChange={(next) => onSet(tokens, emptyValue(next))}
      />
      <span className="form-count">{count}</span>
      <button className="btn btn-sm btn-danger form-remove" title="Remove" onClick={() => onRemove(tokens)}>
        <Icon.Trash />
      </button>
    </header>
  )
}

function Field({ value, tokens, label, siblings, index, onSet, onRemove, onRenameKey }) {
  const type = typeOf(value)

  return (
    <div className="form-field" title={formatPath(tokens)}>
      {label === null ? (
        <span className="form-index">Item {index + 1}</span>
      ) : (
        <KeyLabel label={label} tokens={tokens} siblings={siblings} onRenameKey={onRenameKey} />
      )}

      <TypeSelect
        type={type}
        onChange={(next) => onSet(tokens, next === type ? value : convert(value, next))}
      />

      <ValueControl type={type} value={value} onChange={(next) => onSet(tokens, next)} />

      <button className="btn btn-sm btn-danger form-remove" title="Remove" onClick={() => onRemove(tokens)}>
        <Icon.Trash />
      </button>
    </div>
  )
}

/**
 * The field name, edited in place. Each keystroke that yields a usable name is applied at once,
 * so what the form shows is always what the document holds; a name that cannot be applied yet
 * (empty, or already taken by a sibling) is kept as a draft and explained underneath.
 */
function KeyLabel({ label, tokens, siblings = [], onRenameKey }) {
  const [draft, setDraft] = useState(label)

  useEffect(() => setDraft(label), [label])

  const trimmed = draft.trim()
  const taken = trimmed !== label && siblings.includes(trimmed)
  const problem = !trimmed ? 'A field needs a name' : taken ? 'That name is already used here' : null

  const change = (next) => {
    setDraft(next)
    const name = next.trim()
    if (!name || name === label || siblings.includes(name)) return
    onRenameKey(tokens.slice(0, -1), label, name)
  }

  return (
    <span className="form-key-cell">
      <input
        className={`form-key${problem ? ' is-invalid' : ''}`}
        value={draft}
        spellCheck="false"
        aria-label="Field name"
        onChange={(event) => change(event.target.value)}
        // Nothing is pending on blur, so an unusable draft simply reverts.
        onBlur={() => setDraft(label)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' || event.key === 'Enter') event.target.blur()
        }}
      />
      {problem && <span className="form-error">{problem}</span>}
    </span>
  )
}

function TypeSelect({ type, onChange }) {
  return (
    <select className="form-type" value={type} onChange={(event) => onChange(event.target.value)} aria-label="Type">
      {TYPES.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  )
}

function ValueControl({ type, value, onChange }) {
  // Numbers need a draft: "1." and "-" are worth typing but are not numbers yet.
  const [draft, setDraft] = useState(String(value ?? ''))

  useEffect(() => {
    if (type === 'number' && Number(draft) !== value) setDraft(String(value))
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  if (type === 'boolean') {
    return (
      <select className="input form-value-input" value={String(value)} onChange={(event) => onChange(event.target.value === 'true')}>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    )
  }

  if (type === 'null') {
    return <input className="input form-value-input" value="null" disabled />
  }

  if (type === 'number') {
    const invalid = draft.trim() === '' || Number.isNaN(Number(draft))
    return (
      <div className="form-value-input">
        <input
          className={`input${invalid ? ' is-invalid' : ''}`}
          value={draft}
          inputMode="decimal"
          onChange={(event) => {
            setDraft(event.target.value)
            const parsed = Number(event.target.value)
            if (event.target.value.trim() !== '' && !Number.isNaN(parsed)) onChange(parsed)
          }}
        />
        {invalid && <span className="form-error">Not a number</span>}
      </div>
    )
  }

  return (
    <input
      className="input form-value-input"
      value={value}
      placeholder="value"
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

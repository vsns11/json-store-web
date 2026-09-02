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

function safeParse(text) {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

const getIn = (root, tokens) => tokens.reduce((current, token) => current?.[token], root)

/**
 * The document laid out as its JSON tree — braces, indentation and colouring included — with every
 * key and value editable in place. Reading it is reading the JSON; editing it never means typing
 * punctuation.
 */
export default function FormEditor({ text, isEmpty, onChange }) {
  const root = isEmpty ? {} : safeParse(text)

  if (root === undefined || !isContainer(root)) {
    return (
      <div className="empty">
        <div>
          <h2>This payload is a single value</h2>
          <p>The tree edits documents built from objects and lists. Use the Editor tab for a bare value.</p>
        </div>
      </div>
    )
  }

  const apply = (next) => onChange(JSON.stringify(next, null, 2))

  const handlers = {
    onSet: (tokens, value) => apply(setAtPath(root, tokens, value)),
    onRemove: (tokens) => apply(deleteAtPath(root, tokens)),
    onRenameKey: (parentTokens, from, to) => {
      const parent = parentTokens.length === 0 ? root : getIn(root, parentTokens)
      const renamed = Object.fromEntries(
        Object.entries(parent).map(([key, item]) => [key === from ? to : key, item]),
      )
      apply(parentTokens.length === 0 ? renamed : setAtPath(root, parentTokens, renamed))
    },
  }

  return (
    <div className="jform">
      <Node value={root} tokens={[]} label={null} isLast isRoot {...handlers} />
    </div>
  )
}

function Node(props) {
  const { value } = props
  if (Array.isArray(value)) return <BranchNode {...props} brackets="[]" />
  if (isContainer(value)) return <BranchNode {...props} brackets="{}" />
  return <LeafNode {...props} />
}

/** An object or a list: an opening line, indented children, and a closing line. */
function BranchNode({ value, tokens, label, siblings, isLast, isRoot, brackets, onSet, onRemove, onRenameKey }) {
  const [open, setOpen] = useState(true)
  const isArray = brackets === '[]'
  const entries = isArray ? value.map((item, index) => [index, item]) : Object.entries(value)
  const [openBrace, closeBrace] = brackets.split('')
  const summary = `${entries.length} ${isArray ? 'item' : 'field'}${entries.length === 1 ? '' : 's'}`

  return (
    <div className="jnode">
      <div className="jline" title={isRoot ? undefined : formatPath(tokens)}>
        <button className="jtoggle" onClick={() => setOpen(!open)} aria-label={open ? 'Collapse' : 'Expand'}>
          {open ? '▾' : '▸'}
        </button>

        {label !== null && (
          <KeyInput label={label} tokens={tokens} siblings={siblings} onRenameKey={onRenameKey} />
        )}

        <span className="jpunct">{openBrace}</span>

        {!open && (
          <button className="jcollapsed" onClick={() => setOpen(true)}>
            … {summary} <span className="jpunct">{closeBrace}</span>
            {!isLast && <span className="jpunct">,</span>}
          </button>
        )}

        {open && <span className="jmeta">{summary}</span>}

        {!isRoot && (
          <RowControls
            type={isArray ? 'array' : 'object'}
            onType={(next) => onSet(tokens, emptyValue(next))}
            onRemove={() => onRemove(tokens)}
          />
        )}
      </div>

      {open && (
        <>
          <div className="jchildren">
            {entries.map(([key, item], position) => (
              <Node
                key={position}
                value={item}
                label={isArray ? null : key}
                siblings={isArray ? undefined : entries.map(([name]) => name)}
                tokens={[...tokens, key]}
                isLast={position === entries.length - 1}
                onSet={onSet}
                onRemove={onRemove}
                onRenameKey={onRenameKey}
              />
            ))}

            <button
              className="jadd"
              onClick={() =>
                isArray
                  ? // A new row copies the shape of the last one, so lists of objects stay consistent.
                    onSet([...tokens, value.length], value.length ? blankLike(value.at(-1)) : '')
                  : onSet([...tokens, uniqueKey(value)], '')
              }
            >
              <Icon.Plus /> {isArray ? 'item' : 'field'}
            </button>
          </div>

          <div className="jline jclose">
            <span className="jtoggle" />
            <span className="jpunct">{closeBrace}</span>
            {!isLast && <span className="jpunct">,</span>}
          </div>
        </>
      )}
    </div>
  )
}

function LeafNode({ value, tokens, label, siblings, isLast, onSet, onRemove, onRenameKey }) {
  const type = typeOf(value)

  return (
    <div className="jline" title={formatPath(tokens)}>
      <span className="jtoggle" />

      {label !== null && <KeyInput label={label} tokens={tokens} siblings={siblings} onRenameKey={onRenameKey} />}

      <ValueInput type={type} value={value} onChange={(next) => onSet(tokens, next)} />
      {!isLast && <span className="jpunct">,</span>}

      <RowControls
        type={type}
        onType={(next) => onSet(tokens, next === type ? value : convert(value, next))}
        onRemove={() => onRemove(tokens)}
      />
    </div>
  )
}

/**
 * The key, edited in place. Each keystroke that yields a usable name is applied at once, so what
 * the tree shows is always what the document holds; a name that cannot be applied yet (empty, or
 * already taken by a sibling) stays a draft and is explained beside it.
 */
function KeyInput({ label, tokens, siblings = [], onRenameKey }) {
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
    <>
      <span className="jpunct">"</span>
      <input
        className={`jkey${problem ? ' is-invalid' : ''}`}
        value={draft}
        size={1}
        style={{ width: `${Math.max(draft.length, 1)}ch` }}
        spellCheck="false"
        aria-label="Field name"
        onChange={(event) => change(event.target.value)}
        onBlur={() => setDraft(label)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' || event.key === 'Enter') event.target.blur()
        }}
      />
      <span className="jpunct">"</span>
      <span className="jpunct">:</span>
      {problem && <span className="jproblem">{problem}</span>}
    </>
  )
}

function ValueInput({ type, value, onChange }) {
  // Numbers need a draft: "1." and "-" are worth typing but are not numbers yet.
  const [draft, setDraft] = useState(String(value ?? ''))

  useEffect(() => {
    if (type === 'number' && Number(draft) !== value) setDraft(String(value))
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  if (type === 'boolean') {
    return (
      <select
        className="jval token-boolean jselect"
        value={String(value)}
        onChange={(event) => onChange(event.target.value === 'true')}
      >
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    )
  }

  if (type === 'null') {
    return <span className="jval token-null">null</span>
  }

  if (type === 'number') {
    const invalid = draft.trim() === '' || Number.isNaN(Number(draft))
    return (
      <>
        <input
          className={`jval token-number${invalid ? ' is-invalid' : ''}`}
          value={draft}
          inputMode="decimal"
          style={{ width: `${Math.max(draft.length, 1)}ch` }}
          onChange={(event) => {
            setDraft(event.target.value)
            const parsed = Number(event.target.value)
            if (event.target.value.trim() !== '' && !Number.isNaN(parsed)) onChange(parsed)
          }}
        />
        {invalid && <span className="jproblem">not a number</span>}
      </>
    )
  }

  return (
    <>
      <span className="jpunct token-string">"</span>
      <input
        className="jval token-string"
        value={value}
        style={{ width: `${Math.max(String(value).length, 1)}ch` }}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="jpunct token-string">"</span>
    </>
  )
}

/** The controls that appear at the end of a line on hover: change type, remove. */
function RowControls({ type, onType, onRemove }) {
  return (
    <span className="jactions">
      <select className="jtype" value={type} onChange={(event) => onType(event.target.value)} aria-label="Type">
        {TYPES.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <button className="jremove" title="Remove" onClick={onRemove}>
        <Icon.Trash />
      </button>
    </span>
  )
}

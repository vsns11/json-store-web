/**
 * Composing one large document out of small JSON fragments.
 *
 * A fragment contributes a body and the fields it needs. Bodies are merged in catalogue order —
 * objects deeply, lists by appending — and `${field}` placeholders are filled in from the values
 * the form collected. A string that is exactly one placeholder keeps the field's own type, so
 * `"replicas": "${replicas}"` becomes a number rather than a string.
 */

const PLACEHOLDER = /\$\{([\w.]+)\}/g

/**
 * The field keys the selected bodies actually substitute. A field a body never mentions changes
 * nothing, so it is not worth asking for, and is left out of the form.
 */
function usedFieldKeys(catalog, selection) {
  const keys = new Set()

  const scan = (value) => {
    if (typeof value === 'string') {
      for (const match of value.matchAll(PLACEHOLDER)) keys.add(match[1])
    } else if (value !== null && typeof value === 'object') {
      Object.values(value).forEach(scan)
    }
  }

  fragmentsFor(catalog, selection).forEach((fragment) =>
    Object.values(fragment.documents ?? {}).forEach(scan),
  )
  return keys
}

function fragmentsFor(catalog, selection) {
  if (!catalog) return []
  return catalog.groups
    .map((group) => catalog.fragments.find((fragment) => fragment.id === selection[group.id]))
    .filter(Boolean)
}

/**
 * Every field the current selection asks for, in order, without duplicates. When two templates
 * declare the same key, the first declaration is the one shown, but its default comes from the first
 * declaration that has one — the same rule the server composes by, so one template without a default
 * cannot hide another's.
 */
export function fieldsFor(catalog, selection) {
  const used = usedFieldKeys(catalog, selection)
  const byKey = new Map()
  for (const fragment of fragmentsFor(catalog, selection)) {
    for (const field of fragment.fields ?? []) {
      if (!used.has(field.key)) continue
      const kept = byKey.get(field.key)
      if (!kept) byKey.set(field.key, { ...field, fragment: fragment.name })
      else if (kept.default === undefined && field.default !== undefined) kept.default = field.default
    }
  }
  return [...byKey.values()]
}

/** Fields grouped by the fragment that asked for them — one card each in the composer. */
export function fieldCards(catalog, selection) {
  const used = usedFieldKeys(catalog, selection)
  const seen = new Set()
  return fragmentsFor(catalog, selection)
    .map((fragment) => ({
      id: fragment.id,
      name: fragment.name,
      description: fragment.description,
      fields: (fragment.fields ?? []).filter(
        (field) => used.has(field.key) && !seen.has(field.key) && seen.add(field.key),
      ),
    }))
    .filter((card) => card.fields.length > 0)
}

// What a field holds before anyone fills it. A number is null rather than "", because an empty string
// substituted into "${ports}" would store "" where the catalogue declared an integer.
const EMPTY_FOR_TYPE = {
  checkboxes: () => [],
  tags: () => [],
  switch: () => false,
  checkbox: () => false,
  boolean: () => false,
  number: () => null,
  range: () => null,
}

export function defaultValues(fields, existing = {}) {
  return Object.fromEntries(
    fields.map((field) => {
      if (Object.hasOwn(existing, field.key)) return [field.key, existing[field.key]]
      if (field.default !== undefined) return [field.key, field.default]
      return [field.key, (EMPTY_FOR_TYPE[field.type] ?? (() => ''))()]
    }),
  )
}

/**
 * The field values and merged inputs for a selection. Values already typed are kept; fields the new
 * selection introduces get their defaults. Used wherever a selection changes.
 */
export function compose(catalog, selection, values) {
  const next = defaultValues(fieldsFor(catalog, selection), values)
  return { values: next, payload: composeDocument(catalog, selection, next) }
}

/**
 * The documents a selection builds, one per system. A fragment writes into every system it names,
 * so choosing a single scenario can already produce an API request, an event and its assertions.
 */
function composeDocument(catalog, selection, values) {
  const documents = {}
  for (const fragment of fragmentsFor(catalog, selection)) {
    for (const [system, body] of Object.entries(fragment.documents ?? {})) {
      documents[system] = deepMerge(documents[system] ?? {}, substitute(body, values))
    }
  }
  return documents
}

/** Required groups with no template chosen yet, keyed `group:<id>` so they sit beside field problems. */
export function groupProblems(catalog, selection) {
  if (!catalog) return []
  return catalog.groups
    .filter((group) => group.required && !selection[group.id])
    .map((group) => ({ key: `group:${group.id}`, label: group.label, message: `Choose a template for ${group.label}` }))
}

/**
 * What is wrong with each value, by the rules the server refuses a save by, so the form can say so
 * before the round trip. The server still checks: this is a courtesy, not the gate.
 */
export function fieldProblems(fields, values) {
  return fields
    .map((field) => ({ key: field.key, label: field.label ?? field.key, message: problemWith(field, values[field.key]) }))
    .filter((problem) => problem.message)
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

const optionValues = (field) =>
  (field.options ?? []).map((option) => String(typeof option === 'object' ? option.value : option))

function problemWith(field, value) {
  const label = field.label ?? field.key
  const blank =
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
  if (blank) return field.required ? `${label} is required` : null

  switch (field.type ?? 'text') {
    case 'number':
    case 'range':
      if (typeof value !== 'number' || !Number.isFinite(value)) return `${label} must be a number`
      if (typeof field.min === 'number' && value < field.min) return `${label} must be at least ${field.min}`
      if (typeof field.max === 'number' && value > field.max) return `${label} must be at most ${field.max}`
      return null
    case 'date':
      if (typeof value !== 'string' || !DATE.test(value)) return `${label} must be a date, written as YYYY-MM-DD`
      // 2026-02-31 has the right shape, but no such day exists; Date would quietly roll it into March.
      if (Number.isNaN(Date.parse(value)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
        return `${label} is not a real date`
      }
      return null
    case 'select':
    case 'radio': {
      const allowed = optionValues(field)
      return allowed.includes(String(value)) ? null : `${label} must be one of ${allowed.join(', ')}`
    }
    case 'checkboxes': {
      const allowed = optionValues(field)
      return Array.isArray(value) && value.every((item) => allowed.includes(String(item)))
        ? null
        : `${label} can only include ${allowed.join(', ')}`
    }
    default:
      if (field.pattern && typeof value === 'string' && !new RegExp(`^(?:${field.pattern})$`).test(value)) {
        return `${label} is not in the expected format`
      }
      return null
  }
}

/** Which fields are required by the selection but still empty. */
export function missingFields(fields, values) {
  return fields.filter((field) => {
    if (!field.required) return false
    const value = values[field.key]
    if (Array.isArray(value)) return value.length === 0
    if (typeof value === 'boolean' || typeof value === 'number') return false
    return String(value ?? '').trim() === ''
  })
}

function substitute(value, values) {
  if (Array.isArray(value)) return value.map((item) => substitute(item, values))

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, substitute(item, values)]))
  }

  if (typeof value !== 'string') return value

  const whole = value.match(/^\$\{([\w.]+)\}$/)
  if (whole) {
    // The only content is a placeholder, so the field's own type survives, null included.
    return Object.hasOwn(values, whole[1]) ? values[whole[1]] : value
  }
  return value.replace(PLACEHOLDER, (match, key) => (Object.hasOwn(values, key) ? inline(values[key]) : match))
}

/**
 * How a value reads inside a longer string: text as itself, nothing for null, and a list or object
 * as JSON. `String(value)` would print a list as "a,b" and an object as "[object Object]", and the
 * server writes JSON, so the two would disagree about what was stored.
 */
function inline(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function deepMerge(base, addition) {
  if (Array.isArray(base) && Array.isArray(addition)) return [...base, ...addition]

  if (isPlainObject(base) && isPlainObject(addition)) {
    const merged = { ...base }
    for (const [key, value] of Object.entries(addition)) {
      merged[key] = Object.hasOwn(merged, key) ? deepMerge(merged[key], value) : value
    }
    return merged
  }

  return addition
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

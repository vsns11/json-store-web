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
export function usedFieldKeys(catalog, selection) {
  const keys = new Set()

  const scan = (value) => {
    if (typeof value === 'string') {
      for (const match of value.matchAll(PLACEHOLDER)) keys.add(match[1])
    } else if (value !== null && typeof value === 'object') {
      Object.values(value).forEach(scan)
    }
  }

  fragmentsFor(catalog, selection).forEach((fragment) => scan(fragment.body))
  return keys
}

export function fragmentsFor(catalog, selection) {
  if (!catalog) return []
  return catalog.groups
    .map((group) => catalog.fragments.find((fragment) => fragment.id === selection[group.id]))
    .filter(Boolean)
}

/** Every field the current selection asks for, in order, without duplicates. */
export function fieldsFor(catalog, selection) {
  const used = usedFieldKeys(catalog, selection)
  const seen = new Set()
  return fragmentsFor(catalog, selection).flatMap((fragment) =>
    (fragment.fields ?? [])
      .filter((field) => used.has(field.key) && !seen.has(field.key) && seen.add(field.key))
      .map((field) => ({ ...field, fragment: fragment.name })),
  )
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

const EMPTY_FOR_TYPE = {
  checkboxes: () => [],
  tags: () => [],
  switch: () => false,
  checkbox: () => false,
  boolean: () => false,
}

export function defaultValues(fields, existing = {}) {
  return Object.fromEntries(
    fields.map((field) => {
      if (field.key in existing) return [field.key, existing[field.key]]
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
 * The documents a selection builds, keyed by the system each fragment targets. A scenario that
 * feeds an API and a payment system produces one document for each.
 */
export function composeDocument(catalog, selection, values) {
  const documents = {}
  for (const fragment of fragmentsFor(catalog, selection)) {
    const target = fragment.target ?? 'main'
    documents[target] = deepMerge(documents[target] ?? {}, substitute(fragment.body, values))
  }
  return documents
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
    // The only content is a placeholder, so the field's own type survives.
    return whole[1] in values ? values[whole[1]] : value
  }
  return value.replace(PLACEHOLDER, (match, key) => (key in values ? String(values[key]) : match))
}

function deepMerge(base, addition) {
  if (Array.isArray(base) && Array.isArray(addition)) return [...base, ...addition]

  if (isPlainObject(base) && isPlainObject(addition)) {
    const merged = { ...base }
    for (const [key, value] of Object.entries(addition)) {
      merged[key] = key in merged ? deepMerge(merged[key], value) : value
    }
    return merged
  }

  return addition
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

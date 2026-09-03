import { defaultValues, fieldsFor } from './template.js'

const WHOLE_PLACEHOLDER = /^\$\{([\w.]+)\}$/
const ANY_PLACEHOLDER = /\$\{([\w.]+)\}/g

/**
 * Works out which templates a set of inputs was built from, by matching each fragment's body
 * against them: every literal the fragment writes must be present and equal, and each
 * `${placeholder}` reads back the value that was substituted there.
 *
 * This is for profiles stored before the selection was kept alongside them. A value the inputs no
 * longer carry — a field added to the catalogue later — falls back to its default rather than
 * failing the match.
 *
 * @returns {{selection: object, values: object} | null} null when nothing matches confidently
 */
export function inferTemplate(catalog, payload) {
  if (!catalog || payload === null || typeof payload !== 'object') return null

  const selection = {}
  const values = {}

  for (const group of catalog.groups) {
    const fragments = catalog.fragments.filter((fragment) => fragment.group === group.id)

    for (const fragment of fragments) {
      const found = {}
      if (matchesAnyDocument(fragment, payload, found)) {
        selection[group.id] = fragment.id
        Object.assign(values, found)
        break
      }
    }

    // Without the required fragment there is nothing to build a form from.
    if (group.required && !selection[group.id]) return null
  }

  return { selection, values: defaultValues(fieldsFor(catalog, selection), values) }
}

/**
 * Tries the document the fragment feeds, then every other one. Profiles stored before inputs were
 * split per system keep everything in a single document, and they should still get their form.
 */
function matchesAnyDocument(fragment, payload, found) {
  const target = payload[fragment.target ?? 'main']
  if (target !== undefined && matches(fragment.body, target, found)) return true

  return Object.values(payload).some((document) => matches(fragment.body, document, found))
}

function matches(body, value, found) {
  if (typeof body === 'string') return matchesString(body, value, found)

  if (Array.isArray(body)) {
    if (!Array.isArray(value)) return false
    return body.every((item, index) => matches(item, value[index], found))
  }

  if (body !== null && typeof body === 'object') {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
    return Object.entries(body).every(([key, item]) => matches(item, value[key], found))
  }

  return body === value
}

function matchesString(body, value, found) {
  const whole = body.match(WHOLE_PLACEHOLDER)
  if (whole) {
    // A placeholder the inputs do not carry is not a mismatch; the field keeps its default.
    if (value !== undefined) found[whole[1]] = value
    return true
  }

  const keys = [...body.matchAll(ANY_PLACEHOLDER)].map((match) => match[1])
  if (keys.length === 0) return body === value

  if (typeof value !== 'string') return false
  const pattern = new RegExp(`^${body.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\$\\\{[\w.]+\\\}/g, '(.*)')}$`)
  const match = value.match(pattern)
  if (!match) return false
  keys.forEach((key, index) => {
    found[key] = match[index + 1]
  })
  return true
}

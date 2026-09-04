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
 * A fragment matches when every document it writes is found in the inputs. The document it named is
 * tried first; failing that, any of them, because profiles stored before inputs were split per
 * system keep everything in one document and should still get their form.
 */
function matchesAnyDocument(fragment, payload, found) {
  return Object.entries(fragment.documents ?? {}).every(([system, body]) => {
    const named = payload[system]
    if (named !== undefined && matches(body, named, found)) return true
    return Object.values(payload).some((document) => matches(body, document, found))
  })
}

function matches(body, value, found) {
  if (typeof body === 'string') return matchesString(body, value, found)

  if (Array.isArray(body)) {
    if (!Array.isArray(value)) return false
    return matchesList(body, value, found)
  }

  if (body !== null && typeof body === 'object') {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
    return Object.entries(body).every(([key, item]) => matches(item, value[key], found))
  }

  return body === value
}

/**
 * Lists are appended to when fragments merge, so the items one fragment wrote may sit among items
 * another added. They must all be there, in the order the fragment wrote them, with anything else
 * allowed in between — the same rule an object follows for keys it did not write.
 */
function matchesList(body, value, found) {
  let from = 0
  for (const item of body) {
    let index = from
    while (index < value.length) {
      const attempt = {}
      if (matches(item, value[index], attempt)) {
        Object.assign(found, attempt)
        break
      }
      index += 1
    }
    if (index === value.length) return false
    from = index + 1
  }
  return true
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
    // A value cut out of a longer string can only ever be text. One read from a placeholder that
    // stood alone kept its type, so it is the better of the two and is not overwritten here.
    if (!(key in found)) found[key] = match[index + 1]
  })
  return true
}

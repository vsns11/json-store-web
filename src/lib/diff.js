/**
 * What changed between two sets of inputs, as a flat list of paths. Used when comparing profiles:
 * "same but the card is declined" is the question, and a path list answers it directly.
 */
export function diffJson(before, after) {
  const changes = []

  const walk = (a, b, path) => {
    if (Object.is(a, b)) return

    const bothObjects = isPlain(a) && isPlain(b)
    const bothArrays = Array.isArray(a) && Array.isArray(b)

    if (bothObjects || bothArrays) {
      const keys = bothArrays
        ? [...Array(Math.max(a.length, b.length)).keys()]
        : [...new Set([...Object.keys(a), ...Object.keys(b)])]

      for (const key of keys) {
        const step = bothArrays ? `${path}[${key}]` : path ? `${path}.${key}` : String(key)
        const left = a[key]
        const right = b[key]

        if (left === undefined) changes.push({ path: step, kind: 'added', after: right })
        else if (right === undefined) changes.push({ path: step, kind: 'removed', before: left })
        else walk(left, right, step)
      }
      return
    }

    if (JSON.stringify(a) !== JSON.stringify(b)) {
      changes.push({ path: path || '(root)', kind: 'changed', before: a, after: b })
    }
  }

  walk(before, after, '')
  return changes
}

const isPlain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

const MAX_SHOWN = 90

/** How a value reads in the comparison table: short enough for a row, with the rest on hover. */
export function describeValue(value) {
  if (value === undefined) return { short: '—', full: '' }
  const full = typeof value === 'string' ? value : JSON.stringify(value)
  return { short: full.length > MAX_SHOWN ? `${full.slice(0, MAX_SHOWN)}…` : full, full }
}

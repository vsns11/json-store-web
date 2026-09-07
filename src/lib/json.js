/**
 * Reading and measuring the JSON a profile stores.
 *
 * Inputs are only ever written by the template form, so text that does not parse means the form
 * has not built that document yet rather than that someone mistyped something. There is nothing
 * here to report where a mistake is, because there is no longer a way to make one.
 */

/** @returns {{ok: true, value: unknown} | {ok: false, empty: boolean}} */
export function parseJson(text) {
  if (!text.trim()) {
    return { ok: false, empty: true }
  }
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch {
    return { ok: false, empty: false }
  }
}

/** Used to compare composed inputs with stored ones, which jsonb hands back in its own key order. */
export function sortJsonKeys(text, indent = 2) {
  const result = parseJson(text)
  return result.ok ? { ...result, text: JSON.stringify(sortValue(result.value), null, indent) } : result
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort((a, b) => a.localeCompare(b))
        .map((key) => [key, sortValue(value[key])]),
    )
  }
  return value
}

/** Node/key/depth counts, shown in the status bar so large payloads stay comprehensible. */
export function describeShape(value) {
  const shape = { nodes: 0, keys: 0, arrays: 0, objects: 0, depth: 0 }

  const walk = (node, depth) => {
    shape.nodes += 1
    shape.depth = Math.max(shape.depth, depth)
    if (Array.isArray(node)) {
      shape.arrays += 1
      node.forEach((item) => walk(item, depth + 1))
    } else if (node && typeof node === 'object') {
      shape.objects += 1
      for (const [, item] of Object.entries(node)) {
        shape.keys += 1
        walk(item, depth + 1)
      }
    }
  }

  walk(value, 1)
  return shape
}

export function byteSize(text) {
  return new TextEncoder().encode(text).length
}

export function formatBytes(bytes) {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function formatRelativeTime(iso) {
  if (!iso) return '—'
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) {
      return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(-Math.round(seconds / size), unit)
    }
  }
  return 'just now'
}

/**
 * Everything the editor needs to know about a piece of JSON text:
 * parsing with a usable error position, reformatting, and shape statistics.
 */

/** Parses text and, on failure, resolves the error to a line and column. */
export function parseJson(text) {
  if (!text.trim()) {
    return { ok: false, empty: true, error: { message: 'Nothing to parse yet', line: 1, column: 1, position: 0 } }
  }
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (nativeError) {
    return { ok: false, empty: false, error: describeSyntaxError(nativeError, text) }
  }
}

function describeSyntaxError(nativeError, text) {
  // Browsers disagree on whether the message carries a position, so locate it ourselves
  // and only fall back to the engine's message when the scan finds nothing.
  const located = locateSyntaxError(text)
  const position = located?.index ?? Number(nativeError.message.match(/position (\d+)/)?.[1] ?? -1)
  const message = located?.message ?? cleanNativeMessage(nativeError.message)

  if (position < 0) return { message, line: 1, column: 1 }

  const upToError = text.slice(0, position)
  return {
    message,
    line: upToError.split('\n').length,
    column: position - upToError.lastIndexOf('\n'),
    position,
  }
}

function cleanNativeMessage(message) {
  return message
    .replace(/\s*in JSON at position.*$/, '')
    .replace(/,\s*\.\.\..*is not valid JSON$/, '')
    .replace(/^JSON\.parse:\s*/, '')
}

const NUMBER = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/
const ESCAPES = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't'])

/**
 * A minimal scanner that reports where the first syntax error is.
 * JSON.parse stays the authority on validity; this only explains the failure.
 */
function locateSyntaxError(text) {
  let index = 0
  let failure = null

  const fail = (message, at = index) => {
    failure ??= { index: Math.min(at, text.length), message }
    return false
  }
  const skipWhitespace = () => {
    while (index < text.length && ' \t\n\r'.includes(text[index])) index += 1
  }

  const scanString = () => {
    index += 1 // opening quote
    while (index < text.length) {
      const char = text[index]
      if (char === '"') {
        index += 1
        return true
      }
      if (char === '\n') return fail('Unterminated string')
      if (char === '\\') {
        const escape = text[index + 1]
        if (escape === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(text.slice(index + 2, index + 6))) {
            return fail('Invalid \\u escape sequence')
          }
          index += 6
          continue
        }
        if (!ESCAPES.has(escape)) return fail(`Invalid escape "\\${escape ?? ''}"`, index)
        index += 2
        continue
      }
      index += 1
    }
    return fail('Unterminated string')
  }

  const scanNumber = () => {
    const match = text.slice(index).match(NUMBER)
    if (!match) return fail('Invalid number')
    index += match[0].length
    return true
  }

  const scanCollection = (close, scanEntry, emptyHint) => {
    index += 1 // opening bracket
    skipWhitespace()
    if (text[index] === close) {
      index += 1
      return true
    }
    for (;;) {
      skipWhitespace()
      if (index >= text.length) return fail(`Missing closing "${close}"`)
      if (text[index] === close) return fail(`Trailing comma before "${close}"`)
      if (!scanEntry()) return false
      skipWhitespace()
      if (text[index] === ',') {
        index += 1
        continue
      }
      if (text[index] === close) {
        index += 1
        return true
      }
      return fail(index >= text.length ? `Missing closing "${close}"` : `Expected "," or "${close}"${emptyHint}`)
    }
  }

  const scanMember = () => {
    if (text[index] !== '"') return fail('Expected a property name in double quotes')
    if (!scanString()) return false
    skipWhitespace()
    if (text[index] !== ':') return fail('Expected ":" after the property name')
    index += 1
    return scanValue()
  }

  const scanValue = () => {
    skipWhitespace()
    if (index >= text.length) return fail('Unexpected end of input')
    const char = text[index]
    if (char === '{') return scanCollection('}', scanMember, ' after the property')
    if (char === '[') return scanCollection(']', scanValue, ' after the item')
    if (char === '"') return scanString()
    if (char === '-' || (char >= '0' && char <= '9')) return scanNumber()
    for (const literal of ['true', 'false', 'null']) {
      if (text.startsWith(literal, index)) {
        index += literal.length
        return true
      }
    }
    return fail(`Unexpected character "${char}"`)
  }

  if (scanValue()) {
    skipWhitespace()
    if (index < text.length) fail('Unexpected content after the JSON value')
  }
  return failure
}

export function formatJson(text, indent = 2) {
  const result = parseJson(text)
  return result.ok ? { ...result, text: JSON.stringify(result.value, null, indent) } : result
}

export function minifyJson(text) {
  const result = parseJson(text)
  return result.ok ? { ...result, text: JSON.stringify(result.value) } : result
}

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

/** Inserted by the Sample button: the shape a scenario profile usually takes. */
export const SAMPLE_PROFILE = JSON.stringify(
  {
    scenario: 'checkout',
    name: 'Checkout — gift card plus card',
    environment: 'staging',
    customer: { id: 'cus_1042', country: 'NL', loyaltyTier: 'gold' },
    basket: {
      currency: 'EUR',
      lines: [
        { sku: 'NEST-01', quantity: 1, unitPriceMinor: 4999 },
        { sku: 'NEST-CABLE', quantity: 2, unitPriceMinor: 1200 },
      ],
    },
    payment: { method: 'card', brand: 'visa', outcome: 'approved', giftCardMinor: 2000 },
    expected: { outcome: 'success', status: 'paid', emails: ['order-confirmation'] },
    notes: null,
  },
  null,
  2,
)

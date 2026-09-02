/**
 * Splits JSON text into coloured tokens for the editor.
 *
 * It runs on every keystroke, over text that is often half-typed and invalid, so it never parses:
 * it scans for the things JSON is made of and leaves anything it does not recognise as plain text.
 */

const TOKEN = new RegExp(
  [
    '("(?:\\\\.|[^"\\\\])*")(\\s*:)', // a string followed by a colon is a key
    '("(?:\\\\.|[^"\\\\])*")', // any other complete string is a value
    '(-?\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)', // number
    '\\b(true|false)\\b',
    '\\b(null)\\b',
    '([{}\\[\\],:])', // punctuation
  ].join('|'),
  'g',
)

/** Text above this size is shown unhighlighted: colouring it costs more than it is worth. */
export const HIGHLIGHT_LIMIT = 200_000

/**
 * @returns {{text: string, kind: 'key'|'string'|'number'|'boolean'|'null'|'punct'|'plain'}[]}
 */
export function tokenizeJson(text) {
  if (text.length > HIGHLIGHT_LIMIT) return [{ text, kind: 'plain' }]

  const tokens = []
  let lastIndex = 0

  const plain = (upTo) => {
    if (upTo > lastIndex) tokens.push({ text: text.slice(lastIndex, upTo), kind: 'plain' })
  }

  TOKEN.lastIndex = 0
  let match
  while ((match = TOKEN.exec(text)) !== null) {
    const [whole, key, colon, string, number, boolean, nullish, punct] = match
    plain(match.index)

    if (key !== undefined) {
      tokens.push({ text: key, kind: 'key' })
      tokens.push({ text: colon, kind: 'punct' })
    } else if (string !== undefined) {
      tokens.push({ text: string, kind: 'string' })
    } else if (number !== undefined) {
      tokens.push({ text: number, kind: 'number' })
    } else if (boolean !== undefined) {
      tokens.push({ text: boolean, kind: 'boolean' })
    } else if (nullish !== undefined) {
      tokens.push({ text: nullish, kind: 'null' })
    } else {
      tokens.push({ text: punct, kind: 'punct' })
    }

    lastIndex = match.index + whole.length
  }

  plain(text.length)
  return tokens
}

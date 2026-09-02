/**
 * JSON paths for the form editor: parse a path a person typed, walk it, write into it
 * (creating whatever nesting it needs), and flatten a document back into a list of paths.
 *
 * Supported notation:  owner.email · items[0].sku · rollout["region.eu"] · [2].name
 */

const SIMPLE_KEY = /^[A-Za-z_$][\w$]*$/

export class PathError extends Error {}

/** Parses a path into tokens: strings for object keys, numbers for array indexes. */
export function parsePath(path) {
  const text = String(path).trim().replace(/^\$\.?/, '')
  if (!text) throw new PathError('Enter a path, for example owner.email or items[0].sku')

  const tokens = []
  let index = 0

  const readQuoted = (quote) => {
    const end = text.indexOf(quote, index + 1)
    if (end === -1) throw new PathError('Unclosed quote in the path')
    const key = text.slice(index + 1, end)
    index = end + 1
    if (text[index] !== ']') throw new PathError('Expected "]" after the quoted key')
    index += 1
    return key
  }

  while (index < text.length) {
    if (text[index] === '[') {
      index += 1
      if (text[index] === '"' || text[index] === "'") {
        tokens.push(readQuoted(text[index]))
        continue
      }
      const end = text.indexOf(']', index)
      if (end === -1) throw new PathError('Unclosed "[" in the path')
      const inner = text.slice(index, end).trim()
      if (!/^\d+$/.test(inner)) throw new PathError(`"${inner}" is not an array index`)
      tokens.push(Number(inner))
      index = end + 1
      continue
    }

    if (text[index] === '.') {
      if (tokens.length === 0) throw new PathError('A path cannot start with "."')
      index += 1
      if (index >= text.length) throw new PathError('A path cannot end with "."')
      continue
    }

    const next = text.slice(index).search(/[.[]/)
    const key = next === -1 ? text.slice(index) : text.slice(index, index + next)
    if (!key) throw new PathError('Empty key in the path')
    tokens.push(key)
    index += key.length
  }

  return tokens
}

/** Renders tokens back into the canonical path text. */
export function formatPath(tokens) {
  return tokens
    .map((token, position) => {
      if (typeof token === 'number') return `[${token}]`
      if (!SIMPLE_KEY.test(token)) return `[${JSON.stringify(token)}]`
      return position === 0 ? token : `.${token}`
    })
    .join('')
}

const isContainer = (value) => value !== null && typeof value === 'object'

/** Value at a path, or undefined if the path does not exist. */
export function getAtPath(root, tokens) {
  let current = root
  for (const token of tokens) {
    if (!isContainer(current)) return undefined
    current = current[token]
  }
  return current
}

/**
 * Writes a value at a path, creating the objects and arrays along the way — an array when the
 * next token is an index, an object otherwise. Returns a new root; the input is not modified.
 */
export function setAtPath(root, tokens, value) {
  if (tokens.length === 0) return value

  const container = cloneFor(root, tokens[0])
  let current = container

  for (let i = 0; i < tokens.length - 1; i += 1) {
    const token = tokens[i]
    const next = tokens[i + 1]
    const existing = current[token]
    current[token] = isContainer(existing) && typeof next === 'number' === Array.isArray(existing)
      ? shallowCopy(existing)
      : emptyFor(next)
    current = current[token]
  }

  current[tokens.at(-1)] = value
  return container
}

/** Removes the value at a path, leaving the containers around it in place. */
export function deleteAtPath(root, tokens) {
  if (tokens.length === 0) return undefined

  const container = shallowCopy(root)
  let current = container

  for (const token of tokens.slice(0, -1)) {
    if (!isContainer(current[token])) return container
    current[token] = shallowCopy(current[token])
    current = current[token]
  }

  const last = tokens.at(-1)
  if (Array.isArray(current)) current.splice(Number(last), 1)
  else delete current[last]
  return container
}

/**
 * Flattens a document into one entry per leaf, where a leaf is a scalar or an empty
 * object/array. These entries are exactly the rows the form edits.
 */
export function flattenPaths(value, tokens = []) {
  if (!isContainer(value) || Object.keys(value).length === 0) {
    return [{ tokens, path: formatPath(tokens), value }]
  }
  const entries = Array.isArray(value)
    ? value.map((item, index) => [index, item])
    : Object.entries(value)
  return entries.flatMap(([key, item]) => flattenPaths(item, [...tokens, key]))
}

function shallowCopy(value) {
  if (Array.isArray(value)) return [...value]
  if (isContainer(value)) return { ...value }
  return value
}

function emptyFor(token) {
  return typeof token === 'number' ? [] : {}
}

function cloneFor(root, firstToken) {
  const wanted = emptyFor(firstToken)
  if (isContainer(root) && Array.isArray(root) === Array.isArray(wanted)) return shallowCopy(root)
  return wanted
}

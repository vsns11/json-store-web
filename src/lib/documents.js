/**
 * A profile's inputs are a set of named documents, one per system it feeds. The editor holds them
 * as text so half-typed JSON is not lost; these helpers move between that and what the API stores.
 */
import { parseJson } from './json.js'

export const DEFAULT_DOCUMENT = 'main'

/** Stored inputs to editable text, name by name. PostgreSQL does not keep key order, so sort. */
export function toTexts(payload) {
  const entries = Object.entries(payload ?? {}).sort(([a], [b]) => a.localeCompare(b))
  if (entries.length === 0) return { [DEFAULT_DOCUMENT]: '' }
  return Object.fromEntries(entries.map(([name, value]) => [name, JSON.stringify(value, null, 2)]))
}

/** The reverse: text back to the documents the API is given. Only valid text can be sent. */
export function toPayload(texts) {
  return Object.fromEntries(Object.entries(texts).map(([name, text]) => [name, JSON.parse(text)]))
}

/** The documents that are not usable yet, so saving can say which one to look at. */
export function invalidDocuments(texts) {
  return Object.entries(texts)
    .filter(([, text]) => !parseJson(text).ok)
    .map(([name]) => name)
}

/** A name no existing document has, for the "add" button. */
export function nextDocumentName(texts) {
  if (!(DEFAULT_DOCUMENT in texts)) return DEFAULT_DOCUMENT
  let index = 2
  while (`system${index}` in texts) index += 1
  return `system${index}`
}

/** Renaming keeps the documents in a predictable order. */
export function renameDocument(texts, from, to) {
  const renamed = Object.fromEntries(
    Object.entries(texts).map(([name, text]) => [name === from ? to : name, text]),
  )
  return sortByName(renamed)
}

export function sortByName(texts) {
  return Object.fromEntries(Object.entries(texts).sort(([a], [b]) => a.localeCompare(b)))
}

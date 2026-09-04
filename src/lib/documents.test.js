import { describe, expect, it } from 'vitest'
import { invalidDocuments, nextDocumentName, renameDocument, sortByName, toPayload, toTexts } from './documents.js'
import { describeValue, diffJson } from './diff.js'
import { tokenizeJson } from './highlight.js'

describe('documents', () => {
  it('turns stored inputs into sorted text, and back', () => {
    const texts = toTexts({ payments: { a: 1 }, 'orders-api': { b: [2] } })
    expect(Object.keys(texts)).toEqual(['orders-api', 'payments'])
    expect(texts.payments).toBe('{\n  "a": 1\n}')
    expect(toPayload(texts)).toEqual({ 'orders-api': { b: [2] }, payments: { a: 1 } })
  })

  it('starts an empty profile with one empty document', () => {
    expect(toTexts(undefined)).toEqual({ main: '' })
  })

  it('names the documents that do not parse', () => {
    expect(invalidDocuments({ a: '{}', b: '{', c: '' })).toEqual(['b', 'c'])
  })

  it('picks a name no document has yet', () => {
    expect(nextDocumentName({})).toBe('main')
    expect(nextDocumentName({ main: '' })).toBe('system2')
    expect(nextDocumentName({ main: '', system2: '' })).toBe('system3')
  })

  it('renames in place without reordering', () => {
    expect(Object.keys(renameDocument({ b: '1', a: '2' }, 'b', 'z'))).toEqual(['z', 'a'])
    expect(Object.keys(sortByName({ b: '1', a: '2' }))).toEqual(['a', 'b'])
  })
})

describe('diffJson', () => {
  it('lists added, removed and changed paths, nested and indexed', () => {
    const changes = diffJson(
      { a: 1, b: { c: [1, 2], d: 'x' }, gone: true },
      { a: 1, b: { c: [1, 3, 4], d: 'y' }, fresh: null },
    )
    expect(changes).toEqual([
      { path: 'b.c[1]', kind: 'changed', before: 2, after: 3 },
      { path: 'b.c[2]', kind: 'added', after: 4 },
      { path: 'b.d', kind: 'changed', before: 'x', after: 'y' },
      { path: 'gone', kind: 'removed', before: true },
      { path: 'fresh', kind: 'added', after: null },
    ])
  })

  it('reports nothing for equal inputs and a root change for different scalars', () => {
    expect(diffJson({ a: [1] }, { a: [1] })).toEqual([])
    expect(diffJson(1, 2)).toEqual([{ path: '(root)', kind: 'changed', before: 1, after: 2 }])
  })

  it('shortens long values for the table and keeps the whole thing for the tooltip', () => {
    const long = 'x'.repeat(100)
    expect(describeValue(long)).toEqual({ short: `${'x'.repeat(90)}…`, full: long })
    expect(describeValue(undefined)).toEqual({ short: '—', full: '' })
    expect(describeValue({ a: 1 })).toEqual({ short: '{"a":1}', full: '{"a":1}' })
  })
})

describe('tokenizeJson', () => {
  it('colours keys, values and punctuation, and leaves the rest plain', () => {
    const kinds = tokenizeJson('{"k": "v", "n": -1.5e3, "t": true, "z": null}').map((token) => token.kind)
    expect(kinds).toEqual([
      'punct', 'key', 'punct', 'plain', 'string', 'punct', 'plain',
      'key', 'punct', 'plain', 'number', 'punct', 'plain',
      'key', 'punct', 'plain', 'boolean', 'punct', 'plain',
      'key', 'punct', 'plain', 'null', 'punct',
    ])
  })

  it('does not mistake a colon inside a string for a key', () => {
    const tokens = tokenizeJson('{"a": "b: c"}')
    expect(tokens.filter((token) => token.kind === 'key').map((token) => token.text)).toEqual(['"a"'])
  })

  it('keeps half-typed text as plain rather than throwing', () => {
    expect(() => tokenizeJson('{"a": tr')).not.toThrow()
  })
})

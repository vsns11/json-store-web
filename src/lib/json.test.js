import { describe, expect, it } from 'vitest'
import { describeShape, formatBytes, parseJson, sortJsonKeys } from './json.js'

describe('parseJson', () => {
  it('parses valid text', () => {
    expect(parseJson('{"a": [1, 2]}')).toEqual({ ok: true, value: { a: [1, 2] } })
  })

  it('reports empty text as empty rather than unbuilt', () => {
    expect(parseJson('  \n')).toEqual({ ok: false, empty: true })
  })

  it('reports text that does not parse without pretending to know why', () => {
    expect(parseJson('{"a": }')).toEqual({ ok: false, empty: false })
  })
})

describe('sortJsonKeys', () => {
  const text = '{"b":1,"a":{"d":[3,{"z":1,"y":2}],"c":null}}'

  it('sorts keys at every depth, leaving arrays in order', () => {
    expect(sortJsonKeys(text, 0).text).toBe('{"a":{"c":null,"d":[3,{"y":2,"z":1}]},"b":1}')
  })

  it('hands back the failure when the text does not parse', () => {
    expect(sortJsonKeys('{').ok).toBe(false)
  })
})

describe('describeShape', () => {
  it('counts nodes, keys, containers and depth', () => {
    expect(describeShape({ a: [1, { b: 2 }], c: 'x' })).toEqual({
      nodes: 6,
      keys: 3,
      arrays: 1,
      objects: 2,
      depth: 4,
    })
  })

  it('treats a scalar as one node', () => {
    expect(describeShape(42)).toEqual({ nodes: 1, keys: 0, arrays: 0, objects: 0, depth: 1 })
  })
})

describe('formatBytes', () => {
  it.each([
    [null, '—'],
    [0, '0 B'],
    [1023, '1023 B'],
    [1536, '1.5 KB'],
    [3 * 1024 * 1024, '3.0 MB'],
  ])('formats %s as %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected)
  })
})

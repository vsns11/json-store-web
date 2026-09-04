import { describe, expect, it } from 'vitest'
import { describeShape, formatBytes, formatJson, minifyJson, parseJson, sortJsonKeys } from './json.js'

describe('parseJson', () => {
  it('parses valid text', () => {
    expect(parseJson('{"a": [1, 2]}')).toEqual({ ok: true, value: { a: [1, 2] } })
  })

  it('reports empty text as empty rather than broken', () => {
    expect(parseJson('  \n')).toMatchObject({ ok: false, empty: true })
  })

  it.each([
    ['{"a": }', 1, 7, 'Unexpected character "}"'],
    ['{"a": 1,}', 1, 9, 'Trailing comma before "}"'],
    ['{"a": "x\n}', 1, 9, 'Unterminated string'],
    ['{"a": 1 "b": 2}', 1, 9, 'Expected "," or "}" after the property'],
    ['{a: 1}', 1, 2, 'Expected a property name in double quotes'],
    ['[1, 2', 1, 6, 'Missing closing "]"'],
    ['{"a": 1} x', 1, 10, 'Unexpected content after the JSON value'],
    ['{"a": "\\q"}', 1, 8, 'Invalid escape "\\q"'],
  ])('locates the first error in %j', (text, line, column, message) => {
    const result = parseJson(text)
    expect(result.ok).toBe(false)
    expect(result.error).toMatchObject({ line, column, message })
  })

  it('counts lines to reach the error', () => {
    const result = parseJson('{\n  "a": 1,\n  "b": tru\n}')
    expect(result.error).toMatchObject({ line: 3, column: 8 })
  })
})

describe('reformatting', () => {
  const text = '{"b":1,"a":{"d":[3,{"z":1,"y":2}],"c":null}}'

  it('pretty-prints', () => {
    expect(formatJson(text).text).toBe(JSON.stringify(JSON.parse(text), null, 2))
  })

  it('minifies', () => {
    expect(minifyJson('{ "a" : 1 }').text).toBe('{"a":1}')
  })

  it('sorts keys at every depth, leaving arrays in order', () => {
    expect(sortJsonKeys(text, 0).text).toBe('{"a":{"c":null,"d":[3,{"y":2,"z":1}]},"b":1}')
  })

  it('refuses to reformat text that does not parse', () => {
    expect(formatJson('{').ok).toBe(false)
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

import { describe, expect, it } from 'vitest'
import { compose, fieldCards, fieldProblems, fieldsFor, groupProblems, missingFields } from './template.js'
import { inferTemplate } from './templateMatch.js'

/** A small catalogue with the shapes the real one uses: shared fields, typed placeholders, lists. */
const catalog = {
  groups: [
    { id: 'scenario', label: 'Scenario', required: true },
    { id: 'payment', label: 'Payment' },
  ],
  fragments: [
    {
      id: 'checkout',
      group: 'scenario',
      name: 'Checkout',
      fields: [
        { key: 'scenarioName', label: 'Name', type: 'text', default: 'Checkout', required: true },
        { key: 'quantity', label: 'Quantity', type: 'number', default: 1 },
        { key: 'flags', label: 'Flags', type: 'checkboxes', options: ['a', 'b'], default: ['a'] },
        { key: 'unused', label: 'Never substituted', type: 'text' },
      ],
      documents: {
        'orders-api': { path: '/orders', body: { quantity: '${quantity}', flags: '${flags}' }, steps: ['create'] },
        assertions: { scenario: '${scenarioName}', note: 'qty=${quantity}' },
      },
    },
    {
      id: 'card',
      group: 'payment',
      name: 'Card',
      fields: [{ key: 'brand', label: 'Brand', type: 'select', options: ['visa', 'amex'], default: 'visa' }],
      documents: {
        payments: { method: 'card', brand: '${brand}' },
        'orders-api': { steps: ['charge'] },
        assertions: { paid: true },
      },
    },
  ],
}

describe('fieldsFor', () => {
  it('lists only fields a chosen body actually substitutes, in catalogue order', () => {
    const keys = fieldsFor(catalog, { scenario: 'checkout', payment: 'card' }).map((field) => field.key)
    expect(keys).toEqual(['scenarioName', 'quantity', 'flags', 'brand'])
  })

  it('ignores a group whose selection is empty', () => {
    expect(fieldsFor(catalog, { scenario: 'checkout', payment: '' }).map((f) => f.key)).not.toContain('brand')
  })
})

describe('compose', () => {
  it('merges every chosen fragment into the systems it names, keeping value types', () => {
    const { payload, values } = compose(catalog, { scenario: 'checkout', payment: 'card' }, {})

    expect(values).toEqual({ scenarioName: 'Checkout', quantity: 1, flags: ['a'], brand: 'visa' })
    expect(payload['orders-api']).toEqual({
      path: '/orders',
      body: { quantity: 1, flags: ['a'] },
      // Lists from two fragments are appended, not replaced.
      steps: ['create', 'charge'],
    })
    expect(payload.assertions).toEqual({ scenario: 'Checkout', note: 'qty=1', paid: true })
    expect(payload.payments).toEqual({ method: 'card', brand: 'visa' })
  })

  it('keeps typed values and fills in defaults for fields a new selection introduces', () => {
    const { values } = compose(catalog, { scenario: 'checkout', payment: 'card' }, { quantity: 5 })
    expect(values.quantity).toBe(5)
    expect(values.brand).toBe('visa')
  })

  it('builds nothing from an empty selection', () => {
    expect(compose(catalog, {}, {}).payload).toEqual({})
  })
})

describe('fieldCards', () => {
  it('groups fields under the fragment that asked for them and drops empty cards', () => {
    const cards = fieldCards(catalog, { scenario: 'checkout', payment: 'card' })
    expect(cards.map((card) => [card.name, card.fields.map((f) => f.key)])).toEqual([
      ['Checkout', ['scenarioName', 'quantity', 'flags']],
      ['Card', ['brand']],
    ])
  })
})

describe('missingFields', () => {
  it('flags required fields that are blank, but never numbers or booleans', () => {
    const fields = [
      { key: 'name', required: true },
      { key: 'count', required: true },
      { key: 'on', required: true },
      { key: 'list', required: true },
      { key: 'optional' },
    ]
    const missing = missingFields(fields, { name: '  ', count: 0, on: false, list: [], optional: '' })
    expect(missing.map((field) => field.key)).toEqual(['name', 'list'])
  })
})

describe('inferTemplate', () => {
  it('recovers the selection and values from inputs the catalogue built', () => {
    const composed = compose(catalog, { scenario: 'checkout', payment: 'card' }, { quantity: 3, brand: 'amex' })

    const match = inferTemplate(catalog, composed.payload)

    expect(match.selection).toEqual({ scenario: 'checkout', payment: 'card' })
    expect(match.values).toMatchObject({ quantity: 3, brand: 'amex', scenarioName: 'Checkout' })
  })

  it('prefers the typed value from a lone placeholder over text cut out of a longer string', () => {
    const composed = compose(catalog, { scenario: 'checkout' }, { quantity: 7 })
    // The assertions document ("qty=7") is matched after the orders one (7); the number must survive.
    expect(inferTemplate(catalog, composed.payload).values.quantity).toBe(7)

    // Only the text form is present, so text is all there is to read back.
    const textOnly = {
      'orders-api': { path: '/orders', body: { flags: ['a'] }, steps: ['create'] },
      assertions: { scenario: 'Checkout', note: 'qty=9' },
    }
    expect(inferTemplate(catalog, textOnly).values.quantity).toBe('9')
  })

  it('finds a fragment whose list items sit among items another fragment appended', () => {
    // Both fragments add to orders-api.steps; the merged list is ['create', 'charge'].
    const composed = compose(catalog, { scenario: 'checkout', payment: 'card' }, {})
    expect(composed.payload['orders-api'].steps).toEqual(['create', 'charge'])
    expect(inferTemplate(catalog, composed.payload).selection).toEqual({ scenario: 'checkout', payment: 'card' })

    // Take the card's item away and the card no longer matches, while the scenario still does.
    const without = { ...composed.payload, 'orders-api': { ...composed.payload['orders-api'], steps: ['create'] } }
    expect(inferTemplate(catalog, without).selection).toEqual({ scenario: 'checkout' })
  })

  it('gives up when the required group matches nothing', () => {
    expect(inferTemplate(catalog, { main: { anything: 'else' } })).toBeNull()
    expect(inferTemplate(catalog, null)).toBeNull()
  })

  it('still matches inputs stored as one document before they were split per system', () => {
    const composed = compose(catalog, { scenario: 'checkout' }, {})
    const merged = { main: { ...composed.payload['orders-api'], ...composed.payload.assertions } }
    expect(inferTemplate(catalog, merged).selection).toEqual({ scenario: 'checkout' })
  })
})

describe('composing the way the server does', () => {
  const one = (fields, body) => ({
    groups: [{ id: 'g', label: 'G', required: true }],
    fragments: [{ id: 'f', group: 'g', name: 'F', fields, documents: { main: body } }],
  })

  it('writes a list or object inside a longer string as JSON, and null as nothing', () => {
    const catalog = one(
      [{ key: 'servers', type: 'tags' }, { key: 'meta', type: 'text' }, { key: 'note', type: 'text' }],
      { summary: 'dns=${servers}', info: 'meta=${meta}', label: 'note:${note}', raw: '${note}' },
    )
    const { payload } = compose(catalog, { g: 'f' }, { servers: ['10.0.0.1', '10.0.0.2'], meta: { a: 1 }, note: null })
    expect(payload.main.summary).toBe('dns=["10.0.0.1","10.0.0.2"]')
    expect(payload.main.info).toBe('meta={"a":1}')
    expect(payload.main.label).toBe('note:')
    // Standing alone, a placeholder keeps the value's type, so null stays null.
    expect(payload.main.raw).toBeNull()
  })

  it('leaves a number with no default empty as null, never as an empty string', () => {
    const catalog = one([{ key: 'ports', type: 'number' }], { value: '${ports}' })
    const { payload, values } = compose(catalog, { g: 'f' }, {})
    expect(values.ports).toBeNull()
    expect(payload.main.value).toBeNull()
  })

  it('takes a shared field\'s default from the first declaration that has one', () => {
    const catalog = {
      groups: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
      fragments: [
        { id: 'fa', group: 'a', name: 'FA', fields: [{ key: 'v', type: 'text' }], documents: { main: { x: '${v}' } } },
        { id: 'fb', group: 'b', name: 'FB', fields: [{ key: 'v', type: 'text', default: 'fromB' }], documents: { main: { y: '${v}' } } },
      ],
    }
    expect(compose(catalog, { a: 'fa', b: 'fb' }, {}).values.v).toBe('fromB')
  })

  it('does not treat names on Object.prototype as values', () => {
    const catalog = one([{ key: 'a', type: 'text', default: 'x' }], { k: '${toString}', s: 'c=${constructor}', a: '${a}' })
    const { payload } = compose(catalog, { g: 'f' }, {})
    expect(payload.main.k).toBe('${toString}')
    expect(payload.main.s).toBe('c=${constructor}')
    expect(payload.main.a).toBe('x')
  })
})

describe('inferring a template from stored inputs', () => {
  it('does not keep a value from a document that only half matched', () => {
    const catalog = {
      groups: [{ id: 'g', label: 'G', required: true }],
      fragments: [{ id: 'f', group: 'g', name: 'F', fields: [{ key: 'a', type: 'text' }], documents: { sys: { x: 'id-${a}', lit: 1 } } }],
    }
    // The document named "sys" matches x but fails on lit; "other" matches in full.
    const payload = { sys: { x: 'id-WRONG', lit: 2 }, other: { x: 'id-RIGHT', lit: 1 } }
    expect(inferTemplate(catalog, payload).values.a).toBe('RIGHT')
  })
})

describe('the problems a save is refused for', () => {
  const fields = [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'ports', label: 'Ports', type: 'number', min: 1, max: 48 },
    { key: 'since', label: 'In service since', type: 'date' },
    { key: 'vendor', label: 'Vendor', type: 'select', options: ['Nokia', { value: 'Huawei', label: 'Huawei' }] },
    { key: 'flags', label: 'Flags', type: 'checkboxes', options: ['a', 'b'] },
    { key: 'serial', label: 'Serial', type: 'text', pattern: '[A-Z]{4}[0-9A-F]{8}' },
  ]

  it('says nothing about optional fields left empty, including a number emptied to null', () => {
    expect(fieldProblems(fields, { name: 'ONU-1', ports: null, since: '', vendor: '', flags: [], serial: '' })).toEqual([])
  })

  it('names each value the server would refuse, with the same words', () => {
    const problems = fieldProblems(fields, {
      name: '  ',
      ports: 64,
      since: '2026-02-31',
      vendor: 'Cisco',
      flags: ['a', 'z'],
      serial: 'alcl0a1b2c3d',
    })
    expect(Object.fromEntries(problems.map((problem) => [problem.key, problem.message]))).toEqual({
      name: 'Name is required',
      ports: 'Ports must be at most 48',
      since: 'In service since is not a real date',
      vendor: 'Vendor must be one of Nokia, Huawei',
      flags: 'Flags can only include a, b',
      serial: 'Serial is not in the expected format',
    })
  })

  it('refuses text where a number belongs', () => {
    expect(fieldProblems(fields, { name: 'x', ports: '4' })[0]).toMatchObject({ key: 'ports', message: 'Ports must be a number' })
  })

  it('asks for a template in every required group left unset', () => {
    const catalog = {
      groups: [
        { id: 'resource', label: 'Resource type', required: true },
        { id: 'site', label: 'Site' },
      ],
      fragments: [],
    }
    expect(groupProblems(catalog, {})).toEqual([
      { key: 'group:resource', label: 'Resource type', message: 'Choose a template for Resource type' },
    ])
    expect(groupProblems(catalog, { resource: 'onu' })).toEqual([])
  })
})

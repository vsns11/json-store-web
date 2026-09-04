import { describe, expect, it } from 'vitest'
import { compose, fieldCards, fieldsFor, missingFields } from './template.js'
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

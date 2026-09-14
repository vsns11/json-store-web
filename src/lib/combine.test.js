import { describe, expect, it } from 'vitest'
import { combineProfiles, describeOverlap } from './combine.js'

/** A catalogue shaped like the TMF702 one: identifiers are examples, everything else has defaults. */
const catalog = {
  groups: [
    { id: 'resource', label: 'Resource type', required: true },
    { id: 'site', label: 'Site' },
    { id: 'owner', label: 'Related party' },
  ],
  fragments: [
    {
      id: 'onu',
      group: 'resource',
      name: 'ONU',
      fields: [
        { key: 'resourceName', label: 'Resource name', type: 'text', example: 'ONU-0001', required: true },
        { key: 'ports', label: 'Ports', type: 'number', default: 4 },
      ],
      documents: { inventory: { kind: 'onu', name: '${resourceName}', ports: '${ports}' } },
    },
    {
      id: 'olt',
      group: 'resource',
      name: 'OLT',
      fields: [{ key: 'resourceName', label: 'Resource name', type: 'text', example: 'OLT-1', required: true }],
      documents: { inventory: { kind: 'olt', name: '${resourceName}' } },
    },
    {
      id: 'toronto',
      group: 'site',
      name: 'Toronto',
      fields: [{ key: 'siteId', label: 'Site id', type: 'text', default: 'SITE-TOR' }],
      documents: { inventory: { place: { city: 'Toronto', id: '${siteId}' } } },
    },
    {
      id: 'residential',
      group: 'owner',
      name: 'Residential',
      fields: [{ key: 'partyId', label: 'Customer id', type: 'text', example: 'CUST-1' }],
      documents: { inventory: { party: { role: 'customer', id: '${partyId}' } } },
    },
  ],
}

const baseOnu = {
  id: 'a',
  name: 'Base ONU',
  template: { selection: { resource: 'onu' }, values: { resourceName: 'ONU-7', ports: 8 } },
}
const torontoSite = {
  id: 'b',
  name: 'Toronto site',
  template: { selection: { site: 'toronto', owner: 'residential' }, values: { siteId: 'SITE-TOR-02', partyId: 'CUST-9' } },
}

describe('combining saved profiles into a new one', () => {
  it('takes each group from whichever profile chose it, and builds the inputs from all of them', () => {
    const combined = combineProfiles(catalog, [baseOnu, torontoSite])

    expect(combined.selection).toEqual({ resource: 'onu', site: 'toronto', owner: 'residential' })
    expect(combined.from).toEqual({ resource: 'Base ONU', site: 'Toronto site', owner: 'Toronto site' })
    expect(combined.payload.inventory).toEqual({
      kind: 'onu',
      name: '',
      ports: 8,
      place: { city: 'Toronto', id: 'SITE-TOR-02' },
      party: { role: 'customer', id: '' },
    })
    expect(combined.overlaps).toEqual([])
  })

  it('leaves identifiers empty rather than copying them from any source, and says which', () => {
    const combined = combineProfiles(catalog, [baseOnu, torontoSite])

    expect(combined.values.resourceName).toBe('')
    expect(combined.values.partyId).toBe('')
    expect(combined.cleared).toEqual(['Resource name', 'Customer id'])
  })

  it('uses the later pick where two chose differently for the same group, and reports it', () => {
    const oltKit = { id: 'c', name: 'OLT kit', template: { selection: { resource: 'olt' }, values: { resourceName: 'OLT-9' } } }
    const combined = combineProfiles(catalog, [baseOnu, oltKit])

    expect(combined.selection.resource).toBe('olt')
    expect(combined.overlaps).toHaveLength(1)
    expect(describeOverlap(combined.overlaps[0])).toBe('Resource type: OLT from OLT kit, instead of ONU from Base ONU')
  })

  it('uses the later value where two typed differently, and reports only fields the new profile shows', () => {
    const morePorts = { id: 'd', name: 'More ports', template: { selection: { resource: 'onu' }, values: { ports: 16, resourceName: 'ONU-8' } } }
    const combined = combineProfiles(catalog, [baseOnu, morePorts])

    expect(combined.values.ports).toBe(16)
    // The names differ too, but the name starts empty either way, so that overlap is not worth a word.
    expect(combined.overlaps.map(describeOverlap)).toEqual(['Ports: 16 from More ports, instead of 8 from Base ONU'])
  })

  it('reads the order as picked: the same two the other way round give the other answer', () => {
    const morePorts = { id: 'd', name: 'More ports', template: { selection: { resource: 'onu' }, values: { ports: 16 } } }
    expect(combineProfiles(catalog, [morePorts, baseOnu]).values.ports).toBe(8)
  })

  it('leaves out a profile with no template behind it, and names it', () => {
    const handWritten = { id: 'e', name: 'Hand-written', payload: { elsewhere: { anything: true } } }
    const combined = combineProfiles(catalog, [handWritten, torontoSite])

    expect(combined.skipped).toEqual(['Hand-written'])
    expect(combined.selection).toEqual({ site: 'toronto', owner: 'residential' })
  })
})

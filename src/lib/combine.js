import { compose, fieldsFor } from './template.js'
import { inferTemplate } from './templateMatch.js'

/**
 * The templates a saved profile was built from: the ones it recorded, or — for a profile saved before
 * templates were recorded — the ones its inputs match. Null when neither is known.
 */
export function templateOf(catalog, profile) {
  if (Object.values(profile?.template?.selection ?? {}).some(Boolean)) return profile.template
  return inferTemplate(catalog, profile?.payload)
}

const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const fragmentName = (catalog, id) => catalog.fragments.find((fragment) => fragment.id === id)?.name ?? id

/**
 * Combines saved profiles, in the order they were picked, into the starting point for a new one.
 *
 * Each profile brings the template it chose for each group and the values typed into them. Where two
 * chose differently for the same group, or typed different values for the same field, the one picked
 * later is used — so a base goes first and whatever should override it after. Every such overlap is
 * reported, so nothing is replaced without the person seeing it.
 *
 * Fields the catalogue gives an `example` rather than a `default` — names, serial numbers, ids —
 * identify one particular thing, so they start empty rather than being copied from any source.
 *
 * @param {object} catalog
 * @param {object[]} sources full profiles, in the order picked
 * @returns {{
 *   selection: object, values: object, payload: object,
 *   from: Record<string, string>, overlaps: object[], cleared: string[], skipped: string[]
 * }}
 */
export function combineProfiles(catalog, sources) {
  const selection = {}
  const from = {}
  const merged = {}
  const valueFrom = {}
  const groupOverlaps = []
  const valueOverlaps = new Map()
  const skipped = []

  for (const source of sources) {
    const template = templateOf(catalog, source)
    if (!template) {
      skipped.push(source.name)
      continue
    }

    for (const group of catalog.groups) {
      const fragment = template.selection?.[group.id]
      if (!fragment) continue
      if (selection[group.id] && selection[group.id] !== fragment) {
        groupOverlaps.push({
          kind: 'group',
          key: group.id,
          label: group.label,
          kept: fragmentName(catalog, fragment),
          from: source.name,
          replaced: fragmentName(catalog, selection[group.id]),
          replacedFrom: from[group.id],
        })
      }
      selection[group.id] = fragment
      from[group.id] = source.name
    }

    for (const [key, value] of Object.entries(template.values ?? {})) {
      if (Object.hasOwn(merged, key) && !sameValue(merged[key], value)) {
        valueOverlaps.set(key, { kept: value, from: source.name, replaced: merged[key], replacedFrom: valueFrom[key] })
      }
      merged[key] = value
      valueFrom[key] = source.name
    }
  }

  const fields = fieldsFor(catalog, selection)
  const identities = fields.filter((field) => field.example !== undefined)
  const identityKeys = new Set(identities.map((field) => field.key))
  const kept = Object.fromEntries(Object.entries(merged).filter(([key]) => !identityKeys.has(key)))
  const result = compose(catalog, selection, kept)

  // Only overlaps the new profile actually shows are worth reporting: a value for a field no chosen
  // template uses, or for an identifier that starts empty anyway, changes nothing.
  const overlaps = [
    ...groupOverlaps,
    ...fields
      .filter((field) => valueOverlaps.has(field.key) && !identityKeys.has(field.key))
      .map((field) => ({ kind: 'value', key: field.key, label: field.label ?? field.key, ...valueOverlaps.get(field.key) })),
  ]
  const cleared = identities
    .filter((field) => {
      const value = merged[field.key]
      return value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && value.length === 0)
    })
    .map((field) => field.label ?? field.key)

  return { selection, values: result.values, payload: result.payload, from, overlaps, cleared, skipped }
}

const shown = (value) => (typeof value === 'string' ? `“${value}”` : JSON.stringify(value))

/** One overlap as a sentence: what is used, and what it was used instead of. */
export function describeOverlap(overlap) {
  const kept = overlap.kind === 'group' ? overlap.kept : shown(overlap.kept)
  const replaced = overlap.kind === 'group' ? overlap.replaced : shown(overlap.replaced)
  return `${overlap.label}: ${kept} from ${overlap.from}, instead of ${replaced} from ${overlap.replacedFrom}`
}

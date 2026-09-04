/**
 * Stable colour for a piece of text: the same tag or profile name always gets the same colour,
 * in every view and on every machine, without anything being stored against it.
 */
export const PALETTE_SIZE = 8

function paletteIndex(text) {
  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0
  }
  return hash % PALETTE_SIZE
}

/** The class that paints something with its own colour, e.g. `tint-3`. */
export function tintClass(text) {
  return `tint-${paletteIndex(String(text))}`
}

/** Initials for a monogram: two words give two letters, one word gives one. */
export function initialsFor(name) {
  const words = String(name).trim().split(/[\s\-—_]+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

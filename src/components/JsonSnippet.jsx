import { tokenizeJson } from '../lib/highlight.js'

/**
 * One line of JSON, coloured the same way the editor colours it. Used where a profile's inputs are
 * only being glanced at, so the shape is readable without opening anything.
 */
export default function JsonSnippet({ text, className = '' }) {
  if (!text) return null

  return (
    <span className={`json-snippet ${className}`.trim()}>
      {tokenizeJson(text).map((token, index) =>
        token.kind === 'plain' ? (
          token.text
        ) : (
          <span key={index} className={`token-${token.kind}`}>
            {token.text}
          </span>
        ),
      )}
    </span>
  )
}

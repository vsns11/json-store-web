import { useMemo, useRef } from 'react'
import { tokenizeJson } from '../lib/highlight.js'

/**
 * A plain textarea for editing, with a coloured copy of the same text painted underneath and a
 * scroll-synced gutter beside it. The textarea keeps its own caret, selection and undo history;
 * only its text is made transparent, so what you see is the highlighted layer lining up exactly.
 */
export default function JsonEditor({ value, onChange, errorLine, textareaRef }) {
  const gutterRef = useRef(null)
  const layerRef = useRef(null)
  const lineCount = value.split('\n').length
  const tokens = useMemo(() => tokenizeJson(value), [value])

  const handleKeyDown = (event) => {
    if (event.key !== 'Tab') return
    event.preventDefault()
    const input = event.target
    const { selectionStart, selectionEnd } = input
    onChange(`${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`)
    requestAnimationFrame(() => input.setSelectionRange(selectionStart + 2, selectionStart + 2))
  }

  const syncScroll = (event) => {
    const { scrollTop, scrollLeft } = event.target
    if (gutterRef.current) gutterRef.current.scrollTop = scrollTop
    if (layerRef.current) {
      layerRef.current.scrollTop = scrollTop
      layerRef.current.scrollLeft = scrollLeft
    }
  }

  return (
    <>
      <div className="gutter" ref={gutterRef} aria-hidden="true">
        {Array.from({ length: lineCount }, (_, index) => (
          <div key={index} className={index + 1 === errorLine ? 'is-error' : undefined}>
            {index + 1}
          </div>
        ))}
      </div>

      <div className="code-area">
        <pre className="code-layer" ref={layerRef} aria-hidden="true">
          {tokens.map((token, index) =>
            token.kind === 'plain' ? (
              token.text
            ) : (
              <span key={index} className={`token-${token.kind}`}>
                {token.text}
              </span>
            ),
          )}
          {'\n'}
        </pre>

        <textarea
          ref={textareaRef}
          className="code-input"
          value={value}
          spellCheck="false"
          autoComplete="off"
          placeholder={'{\n  "scenario": "checkout"\n}'}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={syncScroll}
        />
      </div>
    </>
  )
}

import { useRef } from 'react'

const LINE_HEIGHT = 20

/** Plain textarea plus a scroll-synced gutter — the error line is highlighted in the gutter. */
export default function JsonEditor({ value, onChange, errorLine, textareaRef }) {
  const gutterRef = useRef(null)
  const lineCount = value.split('\n').length

  const handleKeyDown = (event) => {
    if (event.key !== 'Tab') return
    event.preventDefault()
    const input = event.target
    const { selectionStart, selectionEnd } = input
    const next = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`
    onChange(next)
    requestAnimationFrame(() => input.setSelectionRange(selectionStart + 2, selectionStart + 2))
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
      <textarea
        ref={textareaRef}
        className="code-input"
        value={value}
        spellCheck="false"
        autoComplete="off"
        placeholder={'{\n  "hello": "world"\n}'}
        style={{ minHeight: lineCount * LINE_HEIGHT }}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onScroll={(event) => {
          if (gutterRef.current) gutterRef.current.scrollTop = event.target.scrollTop
        }}
      />
    </>
  )
}

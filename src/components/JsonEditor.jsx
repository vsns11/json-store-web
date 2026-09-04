import { useMemo, useRef } from 'react'
import { tokenizeJson } from '../lib/highlight.js'

const INDENT = '  '

/**
 * Replaces a range of the textarea's text. Goes through the browser's own insert command where it
 * exists, so the edit lands in the native undo history like typing would; otherwise the value is
 * swapped and the caret put back by hand.
 */
function replaceRange(input, start, end, text, onChange, caret = start + text.length, caretEnd = caret) {
  input.focus()
  input.setSelectionRange(start, end)
  let done = false
  try {
    done = document.execCommand('insertText', false, text)
  } catch {
    done = false
  }
  if (done) {
    input.setSelectionRange(caret, caretEnd)
    return
  }
  onChange(input.value.slice(0, start) + text + input.value.slice(end))
  requestAnimationFrame(() => input.setSelectionRange(caret, caretEnd))
}

/** Where the line holding `position` begins and ends. */
function lineBounds(text, position) {
  const start = text.lastIndexOf('\n', position - 1) + 1
  const newline = text.indexOf('\n', position)
  return { start, end: newline === -1 ? text.length : newline }
}

/**
 * A plain textarea for editing, with a coloured copy of the same text painted underneath and a
 * scroll-synced gutter beside it. The textarea keeps its own caret, selection and undo history;
 * only its text is made transparent, so what you see is the highlighted layer lining up exactly.
 *
 * Enter keeps the indent of the line above and goes one deeper after an opening bracket; Tab and
 * Shift+Tab indent and outdent the caret's line or every selected line.
 */
export default function JsonEditor({ value, onChange, errorLine, textareaRef }) {
  const gutterRef = useRef(null)
  const layerRef = useRef(null)
  const stripeRef = useRef(null)
  const lineCount = value.split('\n').length
  const tokens = useMemo(() => tokenizeJson(value), [value])

  const handleKeyDown = (event) => {
    const input = event.target
    const { selectionStart: start, selectionEnd: end } = input

    if (event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
      event.preventDefault()
      const { start: lineStart } = lineBounds(value, start)
      const indent = value.slice(lineStart, start).match(/^[ \t]*/)[0]
      const before = value.slice(0, start).trimEnd().slice(-1)
      const after = value.slice(end).trimStart().charAt(0)
      const opens = before === '{' || before === '['
      const closes = (before === '{' && after === '}') || (before === '[' && after === ']')
      if (closes) {
        // Between a fresh pair of brackets: put the caret on its own indented line, closer below.
        const inserted = `\n${indent}${INDENT}\n${indent}`
        replaceRange(input, start, end, inserted, onChange, start + 1 + indent.length + INDENT.length)
      } else {
        replaceRange(input, start, end, `\n${indent}${opens ? INDENT : ''}`, onChange)
      }
      return
    }

    if (event.key !== 'Tab') return
    event.preventDefault()

    const selected = value.slice(start, end)
    if (!event.shiftKey && !selected.includes('\n')) {
      replaceRange(input, start, end, INDENT, onChange)
      return
    }

    // Line-wise: shift every line the selection touches, keeping the same lines selected after.
    const { start: blockStart } = lineBounds(value, start)
    const { end: blockEnd } = lineBounds(value, Math.max(start, end - (selected.endsWith('\n') ? 1 : 0)))
    const lines = value.slice(blockStart, blockEnd).split('\n')
    const shifted = lines.map((line) => (event.shiftKey ? line.replace(/^ {1,2}/, '') : INDENT + line)).join('\n')
    replaceRange(input, blockStart, blockEnd, shifted, onChange, blockStart, blockStart + shifted.length)
  }

  const syncScroll = (event) => {
    const { scrollTop, scrollLeft } = event.target
    if (gutterRef.current) gutterRef.current.scrollTop = scrollTop
    if (layerRef.current) {
      layerRef.current.scrollTop = scrollTop
      layerRef.current.scrollLeft = scrollLeft
    }
    if (stripeRef.current) stripeRef.current.style.transform = `translateY(${-scrollTop}px)`
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
        {errorLine != null && (
          <div
            ref={stripeRef}
            className="code-error-line"
            style={{ '--line': errorLine, transform: `translateY(${-(textareaRef.current?.scrollTop ?? 0)}px)` }}
            aria-hidden="true"
          />
        )}

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
          autoCapitalize="off"
          aria-label="JSON inputs"
          placeholder={'{\n  "scenario": "checkout"\n}'}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={syncScroll}
        />
      </div>
    </>
  )
}

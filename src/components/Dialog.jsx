import { useEffect, useId, useRef } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * The frame every dialog shares: a dimmed backdrop and Esc that both close it, focus kept inside
 * while it is open and handed back to where it came from afterwards, and a title it is announced by.
 */
export default function Dialog({ title, wide = false, onClose, children, actions, aside }) {
  const titleId = useId()
  const panelRef = useRef(null)

  useEffect(() => {
    const opener = document.activeElement
    const panel = panelRef.current
    // Whatever asked for focus keeps it; otherwise the first control takes it, so Tab starts inside.
    if (panel && !panel.contains(document.activeElement)) panel.querySelector(FOCUSABLE)?.focus()

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      opener?.focus?.()
    }
  }, [onClose])

  // Tab cycles within the dialog rather than wandering off into the page behind it.
  const trapTab = (event) => {
    if (event.key !== 'Tab') return
    const focusable = [...panelRef.current.querySelectorAll(FOCUSABLE)]
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div
        ref={panelRef}
        className={`dialog${wide ? ' dialog-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={trapTab}
      >
        <header className="dialog-head">
          <h3 id={titleId}>{title}</h3>
          {aside}
        </header>
        {children}
        {actions && <div className="dialog-actions">{actions}</div>}
      </div>
    </div>
  )
}

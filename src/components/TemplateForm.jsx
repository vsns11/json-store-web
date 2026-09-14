import { useEffect, useRef } from 'react'
import FormField from './FormField.jsx'

const NONE = ''

/**
 * The fields a template selection asks for: one card per chosen fragment, holding only the fields
 * its body actually substitutes. A new profile also gets the pickers above them; an existing one
 * does not, because its templates are already settled.
 */
export default function TemplateForm({
  catalog,
  selection,
  values,
  cards,
  errors = {},
  summary = [],
  summarySignal = 0,
  showPickers = true,
  onSelect,
  onValue,
}) {
  const summaryRef = useRef(null)
  // Each refused save moves focus to the list, so the reader is told at once what stopped it.
  useEffect(() => {
    if (summarySignal > 0) summaryRef.current?.focus()
  }, [summarySignal])

  return (
    <>
      {summary.length > 0 && (
        <div className="error-summary" role="alert" tabIndex={-1} ref={summaryRef}>
          <p className="error-summary-title">
            {summary.length === 1 ? 'One thing to fix before saving' : `${summary.length} things to fix before saving`}
          </p>
          <ul>
            {summary.map((problem) => (
              <li key={problem.key}>
                <button type="button" onClick={() => focusProblem(problem.key)}>
                  {problem.message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showPickers && (
        <section className="template-section">
          <h3 className="template-heading">Templates</h3>

          <div className="field-grid">
            {catalog.groups.map((group) => {
              const options = catalog.fragments.filter((fragment) => fragment.group === group.id)
              const chosen = catalog.fragments.find((fragment) => fragment.id === selection[group.id])
              const error = errors[`group:${group.id}`]
              const errorId = error ? `group-${group.id}-error` : undefined

              return (
                <label className={`field${error ? ' is-invalid' : ''}`} key={group.id} data-field={`group:${group.id}`}>
                  <span className="field-label">
                    {group.label}
                    {group.required && <em className="field-required"> required</em>}
                  </span>

                  <select
                    id={`group-${group.id}`}
                    className={`input${error ? ' is-invalid' : ''}`}
                    value={selection[group.id] ?? NONE}
                    aria-invalid={error ? true : undefined}
                    aria-required={group.required || undefined}
                    aria-describedby={errorId}
                    onChange={(event) => onSelect({ ...selection, [group.id]: event.target.value })}
                  >
                    {/* An optional group can be left out. A required one cannot: until something is
                        chosen it asks for a choice, and afterwards it can only be changed. */}
                    {group.required ? (
                      !selection[group.id] && (
                        <option value={NONE} disabled>
                          Choose a template…
                        </option>
                      )
                    ) : (
                      <option value={NONE}>— none —</option>
                    )}
                    {options.map((fragment) => (
                      <option key={fragment.id} value={fragment.id}>
                        {fragment.name}
                      </option>
                    ))}
                  </select>

                  {error && (
                    <span className="field-error" id={errorId}>
                      {error}
                    </span>
                  )}
                  {chosen?.description && <span className="field-help">{chosen.description}</span>}
                </label>
              )
            })}
          </div>
        </section>
      )}

      {cards.map((card) => (
        <section className="card" key={card.id}>
          <header className="card-head">
            <h4>{card.name}</h4>
            {card.description && <span className="card-note">{card.description}</span>}
          </header>

          <div className="field-grid card-body">
            {card.fields.map((field) => (
              <FormField
                key={field.key}
                field={field}
                value={values[field.key]}
                error={errors[field.key]}
                onChange={(next) => onValue(field.key, next)}
              />
            ))}
          </div>
        </section>
      ))}

      {cards.length === 0 && (
        <p className="muted template-empty">
          {showPickers
            ? 'Pick a template above to fill in its fields. The inputs are built from what you choose.'
            : 'This profile has no templates behind it.'}
        </p>
      )}
    </>
  )
}

/** Moves focus to the control a problem is about: a group's picker, or a field's first input. */
function focusProblem(key) {
  const byId = key.startsWith('group:') ? `group-${key.slice('group:'.length)}` : `field-${key}`
  const target =
    document.getElementById(byId) ??
    document.querySelector(`[data-field="${CSS.escape(key)}"] :is(input, select, textarea, button)`)
  if (!target) return
  target.scrollIntoView({ block: 'center', behavior: 'smooth' })
  target.focus({ preventScroll: true })
}

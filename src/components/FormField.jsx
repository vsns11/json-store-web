import { useState } from 'react'

/**
 * Every input the template form can draw, chosen by a field's `type`. Adding a control here — and a
 * `type` in the catalogue — is all it takes to offer a new kind of field; nothing else changes.
 *
 *   text · textarea · number · range · date · select · radio
 *   switch · checkbox · checkboxes (array) · tags (array)
 */
export default function FormField({ field, value, onChange, error }) {
  const id = `field-${field.key}`
  const helpId = field.help ? `${id}-help` : null
  const errorId = error ? `${id}-error` : null
  const describedBy = [errorId, helpId].filter(Boolean).join(' ') || undefined

  // A radio group and a checkbox group label themselves, so they use a fieldset rather than a label.
  const grouped = field.type === 'radio' || field.type === 'checkboxes'
  const Wrapper = grouped ? 'fieldset' : 'label'

  return (
    <Wrapper
      className={`field${grouped ? ' field-grouped' : ''}${error ? ' is-invalid' : ''}`}
      htmlFor={grouped ? undefined : id}
      data-field={field.key}
      aria-describedby={grouped ? describedBy : undefined}
    >
      {grouped ? (
        <legend className="field-label">
          <FieldLabel field={field} />
        </legend>
      ) : (
        <span className="field-label">
          <FieldLabel field={field} />
        </span>
      )}

      <Control field={field} id={id} value={value} onChange={onChange} invalid={Boolean(error)} describedBy={describedBy} />

      {error && (
        <span className="field-error" id={errorId}>
          {error}
        </span>
      )}
      {field.help && (
        <span className="field-help" id={helpId}>
          {field.help}
        </span>
      )}
    </Wrapper>
  )
}

function FieldLabel({ field }) {
  return (
    <>
      {field.label}
      {field.required && <em className="field-required"> required</em>}
    </>
  )
}

/**
 * What an empty box shows. An `example` is only ever a hint: unlike a `default`, it is never stored,
 * so a serial number or a customer id cannot be saved by someone who did not type one.
 */
function hintFor(field) {
  if (field.example === undefined) return field.placeholder
  return `e.g. ${Array.isArray(field.example) ? field.example.join(', ') : field.example}`
}

function Control({ field, id, value, onChange, invalid, describedBy }) {
  const className = `input${invalid ? ' is-invalid' : ''}`
  // Said on every control that takes focus, so a screen reader announces both before anyone types.
  const state = { 'aria-invalid': invalid || undefined, 'aria-required': field.required || undefined }

  switch (field.type) {
    case 'textarea':
      return (
        <textarea
          id={id}
          className={`${className} field-textarea`}
          rows={field.rows ?? 3}
          value={value ?? ''}
          placeholder={hintFor(field)}
          aria-describedby={describedBy}
          {...state}
          onChange={(event) => onChange(event.target.value)}
        />
      )

    case 'number':
      return (
        <input
          id={id}
          className={className}
          type="number"
          value={value ?? ''}
          min={field.min}
          max={field.max}
          step={field.step}
          placeholder={hintFor(field)}
          aria-describedby={describedBy}
          {...state}
          // Emptied is null, not "": an empty string would be stored where the catalogue declared a number.
          onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
        />
      )

    case 'range':
      return (
        <span className="field-range">
          <input
            id={id}
            type="range"
            value={Number(value ?? field.min ?? 0)}
            min={field.min ?? 0}
            max={field.max ?? 100}
            step={field.step ?? 1}
            aria-describedby={describedBy}
            {...state}
            onChange={(event) => onChange(Number(event.target.value))}
          />
          {/* The thumb has to sit somewhere, but an untouched slider has no value, and says so. */}
          <output className="field-range-value">{value ?? 'not set'}</output>
        </span>
      )

    case 'date':
      return (
        <input
          id={id}
          className={className}
          type="date"
          value={value ?? ''}
          aria-describedby={describedBy}
          {...state}
          onChange={(event) => onChange(event.target.value)}
        />
      )

    case 'select':
      return (
        <select
          id={id}
          className={className}
          value={value ?? ''}
          aria-describedby={describedBy}
          {...state}
          onChange={(event) => onChange(event.target.value)}
        >
          {/* Without this, a select with nothing chosen would show its first option as if it were. */}
          {(value ?? '') === '' && (
            <option value="" disabled={field.required}>
              Choose…
            </option>
          )}
          {field.options.map((option) => (
            <option key={optionValue(option)} value={optionValue(option)}>
              {optionLabel(option)}
            </option>
          ))}
        </select>
      )

    case 'radio':
      return (
        <span className="choice-group">
          {field.options.map((option) => (
            <label className="choice" key={optionValue(option)}>
              <input
                type="radio"
                name={id}
                value={optionValue(option)}
                checked={value === optionValue(option)}
                onChange={() => onChange(optionValue(option))}
              />
              <span>{optionLabel(option)}</span>
            </label>
          ))}
        </span>
      )

    case 'checkboxes': {
      const selected = Array.isArray(value) ? value : []
      return (
        <span className="choice-group">
          {field.options.map((option) => {
            const item = optionValue(option)
            return (
              <label className="choice" key={item}>
                <input
                  type="checkbox"
                  checked={selected.includes(item)}
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? [...selected, item]
                        : selected.filter((current) => current !== item),
                    )
                  }
                />
                <span>{optionLabel(option)}</span>
              </label>
            )
          })}
        </span>
      )
    }

    case 'checkbox':
      return (
        <label className="choice choice-single">
          <input
            id={id}
            type="checkbox"
            checked={Boolean(value)}
            aria-describedby={describedBy}
            onChange={(event) => onChange(event.target.checked)}
          />
          <span>{field.checkboxLabel ?? 'Yes'}</span>
        </label>
      )

    case 'switch':
      return (
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={Boolean(value)}
          aria-describedby={describedBy}
          className={`switch${value ? ' is-on' : ''}`}
          onClick={() => onChange(!value)}
        >
          <span className="switch-track">
            <span className="switch-thumb" />
          </span>
          <span className="switch-text">{value ? 'On' : 'Off'}</span>
        </button>
      )

    case 'tags':
      return <TagsControl id={id} value={value} onChange={onChange} placeholder={hintFor(field)} state={state} />

    default:
      return (
        <input
          id={id}
          className={className}
          value={value ?? ''}
          placeholder={hintFor(field)}
          aria-describedby={describedBy}
          {...state}
          onChange={(event) => onChange(event.target.value)}
        />
      )
  }
}

/** A list of free-text values, committed with Enter or a comma. */
function TagsControl({ id, value, onChange, placeholder, state }) {
  const items = Array.isArray(value) ? value : []
  const [draft, setDraft] = useState('')

  const add = () => {
    const next = draft.trim()
    if (next && !items.includes(next)) onChange([...items, next])
    setDraft('')
  }

  return (
    <span className="field-tags">
      {items.map((item) => (
        <span className="tag-chip" key={item}>
          {item}
          <button type="button" aria-label={`Remove ${item}`} onClick={() => onChange(items.filter((i) => i !== item))}>
            ×
          </button>
        </span>
      ))}
      <input
        id={id}
        className="tag-input"
        {...state}
        value={draft}
        placeholder={placeholder ?? '+ add'}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={add}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault()
            add()
          } else if (event.key === 'Backspace' && !draft && items.length) {
            onChange(items.slice(0, -1))
          }
        }}
      />
    </span>
  )
}

/** Options may be plain strings or {value, label} pairs. */
const optionValue = (option) => (typeof option === 'object' ? option.value : option)
const optionLabel = (option) => (typeof option === 'object' ? option.label : option)

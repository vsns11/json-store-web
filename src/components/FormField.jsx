import { useState } from 'react'

/**
 * Every input the template form can draw, chosen by a field's `type`. Adding a control here — and a
 * `type` in the catalogue — is all it takes to offer a new kind of field; nothing else changes.
 *
 *   text · textarea · number · range · date · select · radio
 *   switch · checkbox · checkboxes (array) · tags (array)
 */
export default function FormField({ field, value, onChange, invalid }) {
  const id = `field-${field.key}`
  const describedBy = field.help ? `${id}-help` : undefined

  // A radio group and a checkbox group label themselves, so they use a fieldset rather than a label.
  const grouped = field.type === 'radio' || field.type === 'checkboxes'
  const Wrapper = grouped ? 'fieldset' : 'label'

  return (
    <Wrapper className={`field${grouped ? ' field-grouped' : ''}`} htmlFor={grouped ? undefined : id}>
      {grouped ? (
        <legend className="field-label">
          <FieldLabel field={field} />
        </legend>
      ) : (
        <span className="field-label">
          <FieldLabel field={field} />
        </span>
      )}

      <Control field={field} id={id} value={value} onChange={onChange} invalid={invalid} describedBy={describedBy} />

      {field.help && (
        <span className="field-help" id={describedBy}>
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

function Control({ field, id, value, onChange, invalid, describedBy }) {
  const className = `input${invalid ? ' is-invalid' : ''}`

  switch (field.type) {
    case 'textarea':
      return (
        <textarea
          id={id}
          className={`${className} field-textarea`}
          rows={field.rows ?? 3}
          value={value ?? ''}
          placeholder={field.placeholder}
          aria-describedby={describedBy}
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
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value === '' ? '' : Number(event.target.value))}
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
            onChange={(event) => onChange(Number(event.target.value))}
          />
          <output className="field-range-value">{value ?? field.min ?? 0}</output>
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
          onChange={(event) => onChange(event.target.value)}
        >
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
      return <TagsControl id={id} value={value} onChange={onChange} placeholder={field.placeholder} />

    default:
      return (
        <input
          id={id}
          className={className}
          value={value ?? ''}
          placeholder={field.placeholder}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
        />
      )
  }
}

/** A list of free-text values, committed with Enter or a comma. */
function TagsControl({ id, value, onChange, placeholder }) {
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

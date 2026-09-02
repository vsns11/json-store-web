import FormField from './FormField.jsx'

const NONE = ''

/**
 * The template pickers and the fields they ask for: one dropdown per group, then a card of fields
 * for each chosen fragment. Used when composing a new profile and when editing one that was
 * composed earlier.
 */
export default function TemplateForm({ catalog, selection, values, cards, invalidKeys = [], onSelect, onValue }) {
  return (
    <>
      <section className="compose-section">
        <h3 className="compose-heading">Templates</h3>

        <div className="compose-grid">
          {catalog.groups.map((group) => {
            const options = catalog.fragments.filter((fragment) => fragment.group === group.id)
            const chosen = catalog.fragments.find((fragment) => fragment.id === selection[group.id])

            return (
              <label className="field" key={group.id}>
                <span className="field-label">
                  {group.label}
                  {group.required && <em className="field-required"> required</em>}
                </span>

                <select
                  className="input"
                  value={selection[group.id] ?? NONE}
                  onChange={(event) => onSelect({ ...selection, [group.id]: event.target.value })}
                >
                  {!group.required && <option value={NONE}>— none —</option>}
                  {options.map((fragment) => (
                    <option key={fragment.id} value={fragment.id}>
                      {fragment.name}
                    </option>
                  ))}
                </select>

                {chosen?.description && <span className="field-help">{chosen.description}</span>}
              </label>
            )
          })}
        </div>
      </section>

      {cards.map((card) => (
        <section className="card" key={card.id}>
          <header className="card-head">
            <h4>{card.name}</h4>
            {card.description && <span className="card-note">{card.description}</span>}
          </header>

          <div className="compose-grid card-body">
            {card.fields.map((field) => (
              <FormField
                key={field.key}
                field={field}
                value={values[field.key]}
                invalid={invalidKeys.includes(field.key)}
                onChange={(next) => onValue(field.key, next)}
              />
            ))}
          </div>
        </section>
      ))}

      {cards.length === 0 && <p className="muted compose-empty">Pick a template to see its fields.</p>}
    </>
  )
}

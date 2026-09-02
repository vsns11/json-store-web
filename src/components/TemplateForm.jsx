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
  invalidKeys = [],
  showPickers = true,
  onSelect,
  onValue,
}) {
  return (
    <>
      {showPickers && (
        <section className="template-section">
          <h3 className="template-heading">Templates</h3>

          <div className="field-grid">
            {catalog.groups.map((group) => {
              const options = catalog.fragments.filter((fragment) => fragment.group === group.id)
              const chosen = catalog.fragments.find((fragment) => fragment.id === selection[group.id])

              return (
                <label className="field" key={group.id}>
                  <span className="field-label">{group.label}</span>

                  <select
                    className="input"
                    value={selection[group.id] ?? NONE}
                    onChange={(event) => onSelect({ ...selection, [group.id]: event.target.value })}
                  >
                    {/* Every group can be left out: a profile may be written by hand instead. */}
                    <option value={NONE}>— none —</option>
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
                invalid={invalidKeys.includes(field.key)}
                onChange={(next) => onValue(field.key, next)}
              />
            ))}
          </div>
        </section>
      ))}

      {cards.length === 0 && (
        <p className="muted template-empty">
          {showPickers
            ? 'Pick a template to fill in its fields, or write the inputs yourself on the Editor tab.'
            : 'This profile has no templates behind it.'}
        </p>
      )}
    </>
  )
}

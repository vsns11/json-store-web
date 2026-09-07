/**
 * One tab per system this profile feeds, for choosing which of them the tree shows. The set of
 * documents comes from the templates, so there is nothing to add, rename or remove here.
 */
export default function DocumentTabs({ names, active, onSelect }) {
  return (
    <div className="doc-tabs" role="tablist" aria-label="Documents">
      {names.map((name) => (
        <button
          key={name}
          role="tab"
          aria-selected={name === active}
          className={`doc-tab${name === active ? ' is-active' : ''}`}
          onClick={() => onSelect(name)}
        >
          {name}
        </button>
      ))}
    </div>
  )
}

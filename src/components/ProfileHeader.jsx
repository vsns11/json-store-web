import { Icon } from './Icons.jsx'
import TagEditor from './TagEditor.jsx'

/**
 * The top of the editor: a way back to the list, the profile's name and description, and its tags.
 * Everything here is about the profile itself rather than its inputs.
 */
export default function ProfileHeader({ name, description, tags, onChange, onBack }) {
  return (
    <header className="editor-header">
      <div className="header-row">
        <button className="btn btn-ghost back-button" onClick={onBack} title="Back to all profiles">
          <Icon.Back /> All profiles
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            className="title-input"
            value={name}
            placeholder="Name this scenario"
            maxLength={120}
            onChange={(event) => onChange({ name: event.target.value })}
          />
          <input
            className="description-input"
            value={description}
            placeholder="What this scenario covers…"
            maxLength={500}
            onChange={(event) => onChange({ description: event.target.value })}
          />
        </div>
      </div>

      <TagEditor tags={tags} onChange={(next) => onChange({ tags: next })} />
    </header>
  )
}

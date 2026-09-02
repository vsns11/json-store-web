import { useState } from 'react'
import { tintClass } from '../lib/palette.js'

export default function TagEditor({ tags, onChange }) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const value = draft.trim()
    if (value && !tags.includes(value) && tags.length < 12) onChange([...tags, value])
    setDraft('')
  }

  return (
    <div className="tag-editor">
      {tags.map((tag) => (
        <span key={tag} className={`tag-chip ${tintClass(tag)}`}>
          {tag}
          <button type="button" onClick={() => onChange(tags.filter((item) => item !== tag))} aria-label={`Remove ${tag}`}>
            ×
          </button>
        </span>
      ))}
      <input
        className="tag-input"
        value={draft}
        placeholder="+ tag"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={add}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault()
            add()
          } else if (event.key === 'Backspace' && !draft && tags.length) {
            onChange(tags.slice(0, -1))
          }
        }}
      />
    </div>
  )
}

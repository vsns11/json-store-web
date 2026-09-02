import { formatBytes, formatRelativeTime } from '../lib/json.js'

const SORT_OPTIONS = [
  { value: 'updatedAt:desc', label: 'Recently updated' },
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
  { value: 'name:asc', label: 'Name A–Z' },
  { value: 'sizeBytes:desc', label: 'Largest first' },
]

export default function DocumentList({ query, onQueryChange, page, loading, error, onRetry, selectedId, onSelect }) {
  const { items, totalItems, totalPages } = page

  return (
    <section className="panel">
      <header className="list-header">
        <span className="list-title">
          Documents {totalItems > 0 && <span className="muted">· {totalItems}</span>}
        </span>
        <select
          className="sort-select"
          value={`${query.sort}:${query.direction}`}
          onChange={(event) => {
            const [sort, direction] = event.target.value.split(':')
            onQueryChange({ sort, direction })
          }}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </header>

      <div className="doc-list">
        {loading && items.length === 0 && [0, 1, 2, 3].map((key) => <div key={key} className="skeleton" />)}

        {!loading && error && (
          <div style={{ padding: '24px 12px', textAlign: 'center' }}>
            <p className="muted" style={{ fontSize: 13 }}>{error}</p>
            <button className="btn btn-sm" onClick={onRetry}>
              Try again
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="muted" style={{ padding: '24px 12px', textAlign: 'center', fontSize: 13 }}>
            {query.search ? `Nothing matches “${query.search}”` : 'No documents stored yet'}
          </p>
        )}

        {items.map((item) => (
          <button
            key={item.id}
            className={`doc-item${item.id === selectedId ? ' is-active' : ''}`}
            onClick={() => onSelect(item.id)}
          >
            <span className="doc-item-top">
              <span className="doc-name">{item.name}</span>
              <span className="doc-time">{formatRelativeTime(item.updatedAt)}</span>
            </span>
            <span className="doc-preview">{item.preview}</span>
            <span className="doc-meta">
              {item.tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
              <span className="doc-size">{formatBytes(item.sizeBytes)}</span>
            </span>
          </button>
        ))}
      </div>

      {totalPages > 1 && (
        <footer className="list-footer">
          <button
            className="btn btn-sm btn-ghost"
            disabled={query.page === 0}
            onClick={() => onQueryChange({ page: query.page - 1 })}
          >
            ← Prev
          </button>
          <span>
            Page {query.page + 1} of {totalPages}
          </span>
          <button
            className="btn btn-sm btn-ghost"
            disabled={query.page >= totalPages - 1}
            onClick={() => onQueryChange({ page: query.page + 1 })}
          >
            Next →
          </button>
        </footer>
      )}
    </section>
  )
}

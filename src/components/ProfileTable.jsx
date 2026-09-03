import { formatBytes, formatRelativeTime } from '../lib/json.js'
import { initialsFor, tintClass } from '../lib/palette.js'
import { Icon } from './Icons.jsx'
import JsonSnippet from './JsonSnippet.jsx'

const COLUMNS = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'documents', label: 'Systems', sortable: false },
  { key: 'tags', label: 'Tags', sortable: false },
  { key: 'sizeBytes', label: 'Inputs', sortable: true, align: 'right', title: 'Size of the inputs once stored' },
  { key: 'createdAt', label: 'Created', sortable: true },
  { key: 'updatedAt', label: 'Updated', sortable: true },
]

/** Every stored profile at a glance. Editing starts from a row. */
const PAGE_SIZES = [15, 30, 50]

export default function ProfileTable({
  query,
  onQueryChange,
  page,
  loading,
  error,
  onRetry,
  onNew,
  onOpen,
  onDuplicate,
  onDelete,
}) {
  const { items, totalItems, totalPages } = page
  // The size bar is relative to the largest profile on this page, so it always says something.
  const largest = Math.max(1, ...items.map((item) => item.sizeBytes))

  const sortBy = (column) => {
    if (!column.sortable) return
    const direction = query.sort === column.key && query.direction === 'desc' ? 'asc' : 'desc'
    onQueryChange({ sort: column.key, direction })
  }

  return (
    <section className="panel">
      <header className="table-head">
        <h1 className="table-title">
          Profiles
          {totalItems > 0 && <span className="muted"> · {totalItems}</span>}
        </h1>
        {query.search && (
          <button className="btn btn-sm btn-ghost" onClick={() => onQueryChange({ search: '' })}>
            Clear “{query.search}”
          </button>
        )}
        {query.tag && (
          <button className="btn btn-sm btn-ghost" onClick={() => onQueryChange({ tag: '' })}>
            Tag “{query.tag}” ×
          </button>
        )}
        {loading && <span className="spinner" aria-label="Loading" />}
      </header>

      <div className="table-scroll">
        {error ? (
          <div className="table-message">
            <p className="muted">{error}</p>
            <button className="btn btn-sm" onClick={onRetry}>
              Try again
            </button>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                {COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    className={[column.sortable ? 'is-sortable' : '', column.align === 'right' ? 'is-right' : '']
                      .filter(Boolean)
                      .join(' ')}
                    title={column.title}
                    onClick={() => sortBy(column)}
                    aria-sort={query.sort === column.key ? (query.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    {column.label}
                    {query.sort === column.key && <span className="sort-arrow">{query.direction === 'asc' ? '↑' : '↓'}</span>}
                  </th>
                ))}
                <th className="is-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading && items.length === 0 &&
                [0, 1, 2, 3, 4].map((key) => (
                  <tr key={key}>
                    <td colSpan={7}>
                      <div className="skeleton" />
                    </td>
                  </tr>
                ))}

              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="table-message">
                      {query.search || query.tag ? (
                        <p className="muted">Nothing matches what you are looking for.</p>
                      ) : (
                        <>
                          <p className="muted">No profiles yet. A profile is a named set of inputs a test scenario runs with.</p>
                          <button className="btn btn-primary btn-sm" onClick={onNew}>
                            <Icon.Plus /> Create the first one
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {items.map((item) => (
                <tr key={item.id} onClick={() => onOpen(item.id)} tabIndex={0}
                    onKeyDown={(event) => event.key === 'Enter' && onOpen(item.id)}>
                  <td>
                    <span className="cell-title">
                      <span className={`monogram ${tintClass(item.name)}`} aria-hidden="true">
                        {initialsFor(item.name)}
                      </span>
                      <span className="cell-text">
                        <span className="cell-name">{item.name}</span>
                        {item.description ? (
                          <span className="cell-sub">{item.description}</span>
                        ) : (
                          <JsonSnippet className="cell-sub" text={item.preview} />
                        )}
                      </span>
                    </span>
                  </td>
                  <td>
                    <span className="cell-tags">
                      {(item.documents ?? []).map((name) => (
                        <span key={name} className="doc-pill">
                          {name}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td>
                    <span className="cell-tags">
                      {item.tags.length === 0 && <span className="muted">—</span>}
                      {item.tags.map((tag) => (
                        <button
                          key={tag}
                          className={`tag tag-button ${tintClass(tag)}`}
                          title={`Show only profiles tagged ${tag}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            onQueryChange({ tag })
                          }}
                        >
                          {tag}
                        </button>
                      ))}
                    </span>
                  </td>
                  <td className="is-right">
                    <span className="cell-size">
                      <span className="cell-mono">{formatBytes(item.sizeBytes)}</span>
                      <span className="size-bar" aria-hidden="true">
                        <span style={{ width: `${Math.round((item.sizeBytes / largest) * 100)}%` }} />
                      </span>
                    </span>
                  </td>
                  <td className="cell-time">{formatRelativeTime(item.createdAt)}</td>
                  <td className="cell-time">{formatRelativeTime(item.updatedAt)}</td>
                  <td className="is-right">
                    <span className="row-actions" onClick={(event) => event.stopPropagation()}>
                      <button className="btn btn-sm" onClick={() => onOpen(item.id)}>
                        Edit
                      </button>
                      <button className="btn btn-sm" title="Duplicate" onClick={() => onDuplicate(item)}>
                        <Icon.Copy />
                      </button>
                      <button className="btn btn-sm btn-danger" title="Delete" onClick={() => onDelete(item)}>
                        <Icon.Trash />
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(totalPages > 1 || totalItems > PAGE_SIZES[0]) && (
        <footer className="table-footer">
          <label className="table-jump">
            Rows
            <select
              className="input"
              value={query.size}
              onChange={(event) => onQueryChange({ size: Number(event.target.value) })}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>

          {/* With thousands of pages, stepping one at a time is not navigation: the number is typeable. */}
          <label className="table-jump">
            Page
            <input
              className="input"
              type="number"
              min={1}
              max={totalPages}
              value={query.page + 1}
              onChange={(event) => {
                const page = Number(event.target.value) - 1
                if (page >= 0 && page < totalPages) onQueryChange({ page })
              }}
            />
            of {totalPages}
          </label>

          <span className="table-pager">
            <button className="btn btn-sm" disabled={query.page === 0} onClick={() => onQueryChange({ page: 0 })}>
              ⇤ First
            </button>
            <button className="btn btn-sm" disabled={query.page === 0} onClick={() => onQueryChange({ page: query.page - 1 })}>
              ← Previous
            </button>
            <button
              className="btn btn-sm"
              disabled={query.page >= totalPages - 1}
              onClick={() => onQueryChange({ page: query.page + 1 })}
            >
              Next →
            </button>
            <button
              className="btn btn-sm"
              disabled={query.page >= totalPages - 1}
              onClick={() => onQueryChange({ page: totalPages - 1 })}
            >
              Last ⇥
            </button>
          </span>
        </footer>
      )}
    </section>
  )
}

import { Icon } from './Icons.jsx'
import { formatBytes, formatRelativeTime } from '../lib/json.js'

/** The bar across the top: menu toggle, brand, store totals, search, and New profile. */
export default function TopBar({ stats, search, searchRef, onSearch, onToggleMenu, menuExpanded, onNewProfile }) {
  return (
    <header className="topbar">
      <button
        className="btn btn-ghost menu-trigger"
        onClick={onToggleMenu}
        aria-expanded={menuExpanded}
        aria-label={menuExpanded ? 'Collapse menu' : 'Expand menu'}
      >
        <Icon.Menu />
      </button>

      <div className="brand">
        <span className="brand-mark">{'{}'}</span>
        <span>JSON Store</span>
      </div>

      <div className="topbar-stats">
        <span>
          Profiles
          <b>{stats?.profiles ?? '—'}</b>
        </span>
        <span>
          Inputs stored
          <b>{formatBytes(stats?.inputBytes)}</b>
        </span>
        <span>
          Last change
          <b>{stats?.lastUpdatedAt ? formatRelativeTime(stats.lastUpdatedAt) : '—'}</b>
        </span>
      </div>

      <span className="topbar-spacer" />

      <div className="search">
        <Icon.Search className="search-icon" />
        <input
          ref={searchRef}
          className="input"
          value={search}
          placeholder="Search names, tags, inputs…"
          onChange={(event) => onSearch(event.target.value)}
        />
        <span className="kbd">⌘K</span>
      </div>

      <button className="btn btn-primary" onClick={onNewProfile}>
        <Icon.Plus /> New profile
      </button>
    </header>
  )
}

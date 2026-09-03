import { Icon } from './Icons.jsx'
import { formatBytes, formatRelativeTime } from '../lib/json.js'
import { initialsFor, tintClass } from '../lib/palette.js'

/** The bar across the top: menu toggle, brand, who is signed in, store totals and search. */
export default function TopBar({ stats, user, search, searchRef, onSearch, onSignOut, onToggleMenu, menuExpanded }) {
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

      {user && (
        <div className="topbar-user">
          <span className={`monogram monogram-sm ${tintClass(user.username)}`} aria-hidden="true">
            {initialsFor(user.username)}
          </span>
          <span className="topbar-user-name" title={`Roles: ${user.roles.join(', ') || 'none'}`}>
            {user.username}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={onSignOut} title="Sign out">
            <Icon.SignOut />
          </button>
        </div>
      )}

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
    </header>
  )
}

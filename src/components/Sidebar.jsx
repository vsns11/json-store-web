import { API_BASE_URL, APP_VERSION } from '../config.js'
import { Icon } from './Icons.jsx'

/** The navigation rail. Collapsed it shows icons; the hamburger expands it in place. */
export default function Sidebar({
  expanded,
  view,
  theme,
  user,
  onShowDocuments,
  onNewDocument,
  onCompose,
  onRefresh,
  onToggleTheme,
  onShowShortcuts,
  onSignOut,
}) {
  const items = [
    { key: 'documents', label: 'All documents', icon: <Icon.Table />, active: view === 'table', onClick: onShowDocuments },
    { key: 'new', label: 'New document', icon: <Icon.Plus />, active: view === 'editor', onClick: onNewDocument },
    { key: 'compose', label: 'New from template', icon: <Icon.Layers />, active: view === 'compose', onClick: onCompose },
    { key: 'refresh', label: 'Refresh', icon: <Icon.Refresh />, onClick: onRefresh },
    {
      key: 'theme',
      label: theme === 'dark' ? 'Light theme' : 'Dark theme',
      icon: theme === 'dark' ? <Icon.Sun /> : <Icon.Moon />,
      onClick: onToggleTheme,
    },
    { key: 'shortcuts', label: 'Keyboard shortcuts', icon: <Icon.Keyboard />, onClick: onShowShortcuts },
  ]

  return (
    <aside className={`sidebar${expanded ? ' is-expanded' : ''}`}>
      <nav>
        {items.map((item) => (
          <button
            key={item.key}
            className={`side-item${item.active ? ' is-active' : ''}`}
            onClick={item.onClick}
            title={expanded ? undefined : item.label}
          >
            <span className="side-icon">{item.icon}</span>
            <span className="side-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <footer className="side-footer">
        {user && (
          <div className="side-user">
            <span className="side-user-name" title={`Roles: ${user.roles.join(', ') || 'none'}`}>
              {user.username}
            </span>
            <button className="side-signout" onClick={onSignOut} title="Sign out">
              <Icon.SignOut /> Sign out
            </button>
          </div>
        )}
        <span>Version {APP_VERSION}</span>
        <span title={API_BASE_URL || window.location.origin}>API {API_BASE_URL || 'same origin'}</span>
      </footer>
    </aside>
  )
}

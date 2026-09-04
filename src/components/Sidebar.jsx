import { Icon } from './Icons.jsx'

/**
 * The navigation rail. Collapsed it shows icons; the hamburger expands it in place. On a narrow
 * window it turns into a row of icons under the top bar instead.
 *
 * Only a destination the app is actually on is highlighted — editing an existing profile arrives
 * from the table, so nothing is marked active then.
 */
export default function Sidebar({
  expanded,
  activeItem,
  theme,
  onShowProfiles,
  onNewProfile,
  onRefresh,
  onToggleTheme,
  onShowShortcuts,
}) {
  const items = [
    { key: 'profiles', label: 'All profiles', icon: <Icon.Table />, onClick: onShowProfiles },
    { key: 'new', label: 'New profile', icon: <Icon.Plus />, onClick: onNewProfile },
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
      <nav aria-label="Main">
        {items.map((item) => (
          <button
            key={item.key}
            className={`side-item${item.key === activeItem ? ' is-active' : ''}`}
            onClick={item.onClick}
            title={item.label}
            aria-label={item.label}
            aria-current={item.key === activeItem ? 'page' : undefined}
          >
            <span className="side-icon">{item.icon}</span>
            <span className="side-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  )
}

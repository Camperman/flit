import type { AppInfo } from '../shared/types'

interface AppRailProps {
  apps: AppInfo[]
  activeId?: string
  disabled: boolean
  /** 'rail' = vertical left column (favicon + label); 'top' = compact icon row. */
  variant: 'rail' | 'top'
  onOpen: (shortcutId: string) => void
  onAdd: () => void
  onContextMenu: (shortcutId: string) => void
}

// The app launcher. In 'rail' mode it's a vertical column between the profile
// avatars and the page (favicon + label + badge); in 'top' mode it's a compact
// icon row pinned to the right of the title bar. Clicking opens/focuses the
// app's tab; right-click to edit/remove; [+] adds an app.
export function AppRail({
  apps,
  activeId,
  disabled,
  variant,
  onOpen,
  onAdd,
  onContextMenu
}: AppRailProps): JSX.Element {
  return (
    <nav
      className={`apprail${variant === 'top' ? ' apprail--top' : ''}`}
      data-testid="apprail"
      aria-label="Apps"
    >
      {apps.map((app) => (
        <button
          key={app.id}
          type="button"
          className={`apprail__item${app.id === activeId ? ' apprail__item--active' : ''}`}
          title={app.label}
          data-testid={`app-${app.id}`}
          disabled={disabled}
          onClick={() => onOpen(app.id)}
          onContextMenu={(e) => {
            e.preventDefault()
            onContextMenu(app.id)
          }}
        >
          <span className="apprail__icon">
            {app.favicon ? (
              <img src={app.favicon} alt="" />
            ) : (
              app.label.charAt(0).toUpperCase()
            )}
            {app.unread > 0 && (
              <span className="apprail__badge" data-testid={`app-badge-${app.id}`}>
                {app.unread > 99 ? '99+' : app.unread}
              </span>
            )}
          </span>
          {variant === 'rail' && <span className="apprail__label">{app.label}</span>}
        </button>
      ))}
      <button
        type="button"
        className="apprail__add"
        title="Add app"
        data-testid="add-shortcut"
        disabled={disabled}
        onClick={onAdd}
      >
        +
      </button>
    </nav>
  )
}

import type { CSSProperties } from 'react'
import type { AccountSummary } from '../shared/types'

interface SidebarProps {
  accounts: AccountSummary[]
  activeId?: string
  onSelect: (id: string) => void
  onAdd: () => void
  onContextMenu: (id: string, x: number, y: number) => void
}

// Left rail of account avatars. Click switches; right-click opens edit/remove.
// Phase 6 adds avatar polish + unread badges.
export function Sidebar({
  accounts,
  activeId,
  onSelect,
  onAdd,
  onContextMenu
}: SidebarProps): JSX.Element {
  return (
    <nav className="sidebar" data-testid="sidebar" aria-label="Accounts">
      <div className="sidebar__brand" title="Glide">
        G
      </div>
      <div className="sidebar__accounts">
        {accounts.map((account) => (
          <button
            key={account.id}
            type="button"
            className={`account${account.id === activeId ? ' account--active' : ''}`}
            style={{ '--account-color': account.color } as CSSProperties}
            title={account.label}
            data-testid={`account-${account.id}`}
            aria-pressed={account.id === activeId}
            onClick={() => onSelect(account.id)}
            onContextMenu={(e) => {
              e.preventDefault()
              onContextMenu(account.id, e.clientX, e.clientY)
            }}
          >
            {account.label.charAt(0).toUpperCase()}
          </button>
        ))}
      </div>
      <button
        className="sidebar__add"
        type="button"
        title="Add account"
        data-testid="add-account"
        onClick={onAdd}
      >
        +
      </button>
    </nav>
  )
}

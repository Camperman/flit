import type { CSSProperties } from 'react'
import type { AccountSummary } from '../shared/types'

interface SidebarProps {
  accounts: AccountSummary[]
  activeId?: string
  onSelect: (id: string) => void
}

// Left rail of account avatars. Clicking one switches the active account.
// Phase 4 adds the [+] add flow; Phase 6 adds avatars/colors polish + badges.
export function Sidebar({ accounts, activeId, onSelect }: SidebarProps): JSX.Element {
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
          >
            {account.label.charAt(0).toUpperCase()}
          </button>
        ))}
      </div>
      <button className="sidebar__add" type="button" title="Add account (Phase 4)" disabled>
        +
      </button>
    </nav>
  )
}

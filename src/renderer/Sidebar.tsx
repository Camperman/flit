import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { AccountSummary } from '../shared/types'

interface SidebarProps {
  accounts: AccountSummary[]
  activeId?: string
  unread: Record<string, number>
  onSelect: (id: string) => void
  onReorder: (ids: string[]) => void
  onAdd: () => void
  onOpenPreferences: () => void
  onContextMenu: (id: string) => void
  /** When true (unified layout), the app rail is stacked below the accounts. */
  unified?: boolean
  /** The app rail, rendered under the accounts in unified layout. */
  children?: ReactNode
}

// Left rail of account avatars with unread badges. Click switches; right-click
// opens edit/remove; drag reorders. In unified layout the app rail is stacked
// below via `children`.
export function Sidebar({
  accounts,
  activeId,
  unread,
  onSelect,
  onReorder,
  onAdd,
  onOpenPreferences,
  onContextMenu,
  unified,
  children
}: SidebarProps): JSX.Element {
  const dragId = useRef<string | null>(null)
  const [order, setOrder] = useState<AccountSummary[] | null>(null)
  const shown = order ?? accounts

  const onDragStart = (id: string): void => {
    dragId.current = id
    setOrder(accounts)
  }
  const onDragOver = (overId: string): void => {
    const current = order ?? accounts
    const from = current.findIndex((a) => a.id === dragId.current)
    const to = current.findIndex((a) => a.id === overId)
    if (from === -1 || to === -1 || from === to) return
    const next = [...current]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setOrder(next)
  }
  const onDragEnd = (): void => {
    if (order) onReorder(order.map((a) => a.id))
    dragId.current = null
    setOrder(null)
  }

  return (
    <nav
      className={`sidebar${unified ? ' sidebar--unified' : ''}`}
      data-testid="sidebar"
      aria-label="Accounts"
    >
      <div className="sidebar__accounts">
        {shown.map((account) => {
          const count = unread[account.id] ?? 0
          return (
            <div key={account.id} className="account-slot">
              <button
                type="button"
                className={`account${account.id === activeId ? ' account--active' : ''}${account.ephemeral ? ' account--incognito' : ''}`}
                style={{ '--account-color': account.color } as CSSProperties}
                title={account.ephemeral ? 'Incognito (gone on quit)' : account.label}
                data-testid={`account-${account.id}`}
                aria-pressed={account.id === activeId}
                draggable
                onClick={() => onSelect(account.id)}
                onDragStart={() => onDragStart(account.id)}
                onDragOver={(e) => {
                  e.preventDefault()
                  onDragOver(account.id)
                }}
                onDragEnd={onDragEnd}
                onDrop={onDragEnd}
                onContextMenu={(e) => {
                  e.preventDefault()
                  onContextMenu(account.id)
                }}
              >
                {account.ephemeral ? (
                  '🕶'
                ) : account.avatarUrl ? (
                  <img className="account__img" src={account.avatarUrl} alt="" />
                ) : (
                  account.label.charAt(0).toUpperCase()
                )}
              </button>
              {count > 0 && (
                <span className="account__badge" data-testid={`badge-${account.id}`}>
                  {count > 99 ? '99+' : count}
                </span>
              )}
              {account.muted && (
                <span className="account__muted" title="Notifications muted">
                  🔕
                </span>
              )}
            </div>
          )
        })}
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
      {children}
      <button
        className="sidebar__prefs"
        type="button"
        title="Preferences (⌘,)"
        data-testid="open-preferences"
        onClick={onOpenPreferences}
      >
        ⚙
      </button>
    </nav>
  )
}

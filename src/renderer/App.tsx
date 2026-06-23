import { useEffect, useState } from 'react'
import { Sidebar } from './Sidebar'
import type { AccountSummary } from '../shared/types'

export function App(): JSX.Element {
  const [accounts, setAccounts] = useState<AccountSummary[]>([])
  const [activeId, setActiveId] = useState<string | undefined>()

  useEffect(() => {
    void window.glide.listAccounts().then(setAccounts)
    void window.glide.getActive().then(setActiveId)
    const off = window.glide.onActiveChanged(setActiveId)
    return off
  }, [])

  const handleSelect = (id: string): void => {
    setActiveId(id) // optimistic; main also pushes the confirmed value back
    void window.glide.switchAccount(id)
  }

  return (
    <div className="app">
      <Sidebar accounts={accounts} activeId={activeId} onSelect={handleSelect} />
      <main className="content" data-testid="content">
        {accounts.length === 0 && (
          <div className="placeholder">
            <h1>Glide</h1>
            <p>No accounts configured.</p>
          </div>
        )}
      </main>
    </div>
  )
}

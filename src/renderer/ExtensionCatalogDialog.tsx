import { useEffect, useState } from 'react'
import { EXTENSION_CATALOG, storeUrl } from './extensionCatalog'

interface ExtensionCatalogDialogProps {
  accountId: string
  accountLabel: string
  onOpenUrl: (url: string) => void
  onClose: () => void
}

type InstallState = 'idle' | 'installing' | 'installed' | 'error'

// Quick-install catalog for popular Chrome extensions. Installs into the
// active account's partition via the same path as the Web Store's own button.
export function ExtensionCatalogDialog({
  accountId,
  accountLabel,
  onOpenUrl,
  onClose
}: ExtensionCatalogDialogProps): JSX.Element {
  const [state, setState] = useState<Record<string, InstallState>>({})

  // Mark already-installed extensions.
  useEffect(() => {
    void window.flit.listExtensions(accountId).then((installed) => {
      const ids = new Set(installed.map((e) => e.id))
      setState((prev) => {
        const next = { ...prev }
        for (const ext of EXTENSION_CATALOG) {
          if (ids.has(ext.id)) next[ext.id] = 'installed'
        }
        return next
      })
    })
  }, [accountId])

  const install = (id: string): void => {
    setState((s) => ({ ...s, [id]: 'installing' }))
    window.flit
      .installExtension(accountId, id)
      .then(() => setState((s) => ({ ...s, [id]: 'installed' })))
      .catch(() => setState((s) => ({ ...s, [id]: 'error' })))
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--catalog extcat" onClick={(e) => e.stopPropagation()}>
        <h2>Install extensions</h2>
        <p className="extcat__sub">
          Installs into the <strong>{accountLabel}</strong> account (extensions are
          per-account, like Chrome profiles). Not every Chrome extension works in Flit —
          these are known-good picks. Anything else: browse the Web Store in a tab and
          click “Add to Chrome”.
        </p>
        <div className="catalog extcat__list" data-testid="extension-catalog">
          {EXTENSION_CATALOG.map((ext) => {
            const st = state[ext.id] ?? 'idle'
            return (
              <div key={ext.id} className="extcat__row">
                <div className="extcat__meta">
                  <span className="extcat__name">{ext.name}</span>
                  <span className="extcat__blurb">{ext.blurb}</span>
                </div>
                <button
                  type="button"
                  className="btn extcat__store"
                  title="View in Chrome Web Store"
                  onClick={() => {
                    onOpenUrl(storeUrl(ext.id))
                    onClose()
                  }}
                >
                  Store
                </button>
                <button
                  type="button"
                  className={`btn${st === 'idle' || st === 'error' ? ' btn--primary' : ''} extcat__install`}
                  disabled={st === 'installing' || st === 'installed'}
                  data-testid={`install-${ext.id}`}
                  onClick={() => install(ext.id)}
                >
                  {st === 'installing'
                    ? 'Installing…'
                    : st === 'installed'
                      ? 'Installed ✓'
                      : st === 'error'
                        ? 'Retry'
                        : 'Install'}
                </button>
              </div>
            )
          })}
        </div>
        <div className="modal__actions">
          <button
            type="button"
            className="btn extcat__browse"
            data-testid="extcat-webstore"
            onClick={() => {
              onOpenUrl('https://chromewebstore.google.com/')
              onClose()
            }}
          >
            Browse Chrome Web Store…
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

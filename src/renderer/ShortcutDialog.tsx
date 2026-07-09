import { useMemo, useState, type FormEvent } from 'react'
import { APP_CATALOG, catalogIconUrl, type CatalogApp } from './appCatalog'

export interface ShortcutValues {
  label: string
  url: string
}

interface ShortcutDialogProps {
  mode: 'add' | 'edit'
  initial: ShortcutValues
  onSubmit: (values: ShortcutValues) => void
  onCancel: () => void
}

// Catalog tile icon: remote favicon with a letter-chip fallback.
function CatalogIcon({ app }: { app: CatalogApp }): JSX.Element {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return <span className="catalog__letter">{app.label.charAt(0).toUpperCase()}</span>
  }
  return <img src={catalogIconUrl(app.domain)} alt="" onError={() => setFailed(true)} />
}

// Modal for adding or editing a per-profile app/shortcut (label + URL).
// Add mode includes a searchable catalog of popular apps; picking one fills
// the fields (still editable) — any URL works, catalog or not.
export function ShortcutDialog({
  mode,
  initial,
  onSubmit,
  onCancel
}: ShortcutDialogProps): JSX.Element {
  const [label, setLabel] = useState(initial.label)
  const [url, setUrl] = useState(initial.url)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return APP_CATALOG
    return APP_CATALOG.map((cat) => ({
      ...cat,
      apps: cat.apps.filter(
        (a) => a.label.toLowerCase().includes(q) || a.domain.toLowerCase().includes(q)
      )
    })).filter((cat) => cat.apps.length > 0)
  }, [query])

  const pick = (app: CatalogApp): void => {
    setLabel(app.label)
    setUrl(app.url)
  }

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    if (label.trim() && url.trim()) onSubmit({ label, url })
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <form
        className={`modal${mode === 'add' ? ' modal--catalog' : ''}`}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h2>{mode === 'add' ? 'Add app' : 'Edit shortcut'}</h2>

        {mode === 'add' && (
          <>
            <input
              type="text"
              className="catalog__search"
              value={query}
              autoFocus
              placeholder="Search apps (Slack, Outlook, Notion…) or enter a URL below"
              data-testid="catalog-search"
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="catalog" data-testid="catalog">
              {filtered.length === 0 && (
                <p className="catalog__empty">No matches — enter any URL below.</p>
              )}
              {filtered.map((cat) => (
                <div key={cat.name} className="catalog__cat">
                  <h3>{cat.name}</h3>
                  <div className="catalog__grid">
                    {cat.apps.map((app) => (
                      <button
                        key={app.label}
                        type="button"
                        className={`catalog__item${label === app.label && url === app.url ? ' catalog__item--picked' : ''}`}
                        title={app.url}
                        onClick={() => pick(app)}
                      >
                        <CatalogIcon app={app} />
                        <span>{app.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <label className="field">
          <span>Label</span>
          <input
            type="text"
            value={label}
            autoFocus={mode === 'edit'}
            placeholder="Calendar, Drive…"
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>

        <label className="field">
          <span>URL</span>
          <input
            type="text"
            value={url}
            placeholder="https://calendar.google.com"
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>

        <div className="modal__actions">
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary">
            {mode === 'add' ? 'Add' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}

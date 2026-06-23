import { useState, type FormEvent } from 'react'

export interface DialogValues {
  label: string
  color: string
  homeUrl: string
}

interface AccountDialogProps {
  mode: 'add' | 'edit'
  initial: DialogValues
  onSubmit: (values: DialogValues) => void
  onCancel: () => void
}

// Modal for adding or editing an account. In edit mode the home URL is hidden
// (editing is label + color only, per REQUIREMENTS.md §5 Phase 4).
export function AccountDialog({ mode, initial, onSubmit, onCancel }: AccountDialogProps): JSX.Element {
  const [label, setLabel] = useState(initial.label)
  const [color, setColor] = useState(initial.color)
  const [homeUrl, setHomeUrl] = useState(initial.homeUrl)

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    onSubmit({ label, color, homeUrl })
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{mode === 'add' ? 'Add account' : 'Edit account'}</h2>

        <label className="field">
          <span>Label</span>
          <input
            type="text"
            value={label}
            autoFocus
            placeholder="Work, Personal…"
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>

        <label className="field">
          <span>Color</span>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </label>

        {mode === 'add' && (
          <label className="field">
            <span>Home URL</span>
            <input
              type="text"
              value={homeUrl}
              placeholder="https://mail.google.com"
              onChange={(e) => setHomeUrl(e.target.value)}
            />
          </label>
        )}

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

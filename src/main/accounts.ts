import { BrowserWindow, WebContentsView } from 'electron'
import type { AccountSummary } from '../shared/types'

export const SIDEBAR_WIDTH = 64

export interface AccountConfig {
  id: string
  label: string
  color: string
  url: string
}

interface ManagedView {
  config: AccountConfig
  view: WebContentsView
}

export function partitionFor(id: string): string {
  return `persist:account-${id}`
}

/**
 * Owns the lifecycle, layout, and switching of per-account WebContentsViews.
 * Each account runs in its own persistent session partition
 * (`persist:account-<id>`) so cookies and login state never bleed across
 * accounts. Account content is untrusted remote Google pages: no preload,
 * no node integration, context isolation on.
 *
 * Phase 2: multiple hardcoded accounts driven by the sidebar. Phase 3 will
 * persist them; Phase 4 makes the set editable from the UI.
 */
export class AccountManager {
  private readonly win: BrowserWindow
  private readonly views = new Map<string, ManagedView>()
  private order: string[] = []
  private activeId?: string

  constructor(win: BrowserWindow) {
    this.win = win
    this.win.on('resize', () => this.layout())
  }

  load(configs: AccountConfig[]): void {
    for (const config of configs) this.createAccount(config)
  }

  createAccount(config: AccountConfig): void {
    if (this.views.has(config.id)) return

    const view = new WebContentsView({
      webPreferences: {
        partition: partitionFor(config.id),
        contextIsolation: true,
        nodeIntegration: false
      }
    })
    view.setBackgroundColor('#ffffff')
    void view.webContents.loadURL(config.url)

    this.views.set(config.id, { config, view })
    this.order.push(config.id)
    this.win.contentView.addChildView(view)

    if (!this.activeId) this.setActive(config.id)
    this.layout()
  }

  setActive(id: string): void {
    if (!this.views.has(id)) return
    this.activeId = id
    for (const [viewId, { view }] of this.views) {
      view.setVisible(viewId === id)
    }
    this.layout()
    // Push to the renderer so the sidebar can highlight the active item.
    if (!this.win.isDestroyed()) {
      this.win.webContents.send('accounts:active-changed', id)
    }
  }

  getActiveId(): string | undefined {
    return this.activeId
  }

  summaries(): AccountSummary[] {
    return this.order.map((id) => {
      const { config } = this.views.get(id)!
      return { id: config.id, label: config.label, color: config.color }
    })
  }

  /** Map of account id → session partition string (test/diagnostic use). */
  partitions(): Record<string, string> {
    const out: Record<string, string> = {}
    for (const id of this.order) out[id] = partitionFor(id)
    return out
  }

  /** Re-position the active account view in the area right of the sidebar. */
  private layout(): void {
    const [width, height] = this.win.getContentSize()
    const active = this.activeId ? this.views.get(this.activeId) : undefined
    if (!active) return
    active.view.setBounds({
      x: SIDEBAR_WIDTH,
      y: 0,
      width: Math.max(0, width - SIDEBAR_WIDTH),
      height
    })
  }
}

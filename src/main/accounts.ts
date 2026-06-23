import { BrowserWindow, WebContentsView } from 'electron'

export const SIDEBAR_WIDTH = 64

interface ManagedView {
  id: string
  view: WebContentsView
}

/**
 * Owns the lifecycle, layout, and switching of per-account WebContentsViews.
 * Each account runs in its own persistent session partition
 * (`persist:account-<id>`) so cookies and login state never bleed across
 * accounts. Account content is untrusted remote Google pages: no preload,
 * no node integration, context isolation on.
 *
 * Phase 1: a single hardcoded account. Phase 2 adds multiple accounts and
 * sidebar-driven switching on top of this same structure.
 */
export class AccountManager {
  private readonly win: BrowserWindow
  private readonly views = new Map<string, ManagedView>()
  private activeId?: string

  constructor(win: BrowserWindow) {
    this.win = win
    this.win.on('resize', () => this.layout())
  }

  createAccount(id: string, url: string): void {
    if (this.views.has(id)) return

    const view = new WebContentsView({
      webPreferences: {
        partition: `persist:account-${id}`,
        contextIsolation: true,
        nodeIntegration: false
      }
    })
    view.setBackgroundColor('#ffffff')
    void view.webContents.loadURL(url)

    this.views.set(id, { id, view })
    this.win.contentView.addChildView(view)

    if (!this.activeId) this.setActive(id)
    this.layout()
  }

  setActive(id: string): void {
    if (!this.views.has(id)) return
    this.activeId = id
    for (const [viewId, { view }] of this.views) {
      view.setVisible(viewId === id)
    }
    this.layout()
  }

  /** Position the active account view in the area right of the sidebar. */
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

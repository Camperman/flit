import { BrowserWindow, WebContents, WebContentsView, session } from 'electron'
import { randomUUID } from 'crypto'
import type { AccountPatch, AccountSummary, NavState, NewAccountInput } from '../shared/types'
import type { PersistedAccount } from './persistence'

export const SIDEBAR_WIDTH = 64
// Height of the renderer's browser-chrome top bar. The renderer reserves the
// same strip in CSS (.topbar); keep these in sync.
export const TOP_BAR_HEIGHT = 44

export interface AccountConfig {
  id: string
  label: string
  color: string
  homeUrl: string
  lastUrl?: string
}

interface ManagedView {
  config: AccountConfig
  view: WebContentsView
  currentUrl: string
}

export function partitionFor(id: string): string {
  return `persist:account-${id}`
}

/** Ensure a user-entered URL has a scheme; blank stays blank (caller defaults). */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

/**
 * Owns the lifecycle, layout, and switching of per-account WebContentsViews.
 * Each account runs in its own persistent session partition
 * (`persist:account-<id>`) so cookies and login state never bleed across
 * accounts. Account content is untrusted remote Google pages: no preload,
 * no node integration, context isolation on.
 *
 * Tracks each account's current URL so the main process can persist a
 * `lastUrl` to restore on next launch. `onState` is invoked whenever something
 * persistable changes (active account, navigation); the caller debounces saves.
 */
export class AccountManager {
  private readonly win: BrowserWindow
  private readonly onState?: () => void
  private readonly views = new Map<string, ManagedView>()
  private order: string[] = []
  private activeId?: string

  constructor(win: BrowserWindow, onState?: () => void) {
    this.win = win
    this.onState = onState
    this.win.on('resize', () => this.layout())
  }

  load(configs: AccountConfig[]): void {
    for (const config of configs) this.createAccount(config)
  }

  /** Add a brand-new account (UI-driven), make it active, and persist. */
  addAccount(input: NewAccountInput): string {
    const id = randomUUID()
    this.createAccount({
      id,
      label: input.label.trim() || 'Account',
      color: input.color || '#888888',
      homeUrl: normalizeUrl(input.homeUrl) || 'https://mail.google.com'
    })
    this.setActive(id)
    this.emitUpdated()
    this.onState?.()
    return id
  }

  /** Edit an existing account's label/color. */
  updateAccount(id: string, patch: AccountPatch): void {
    const managed = this.views.get(id)
    if (!managed) return
    if (patch.label !== undefined) managed.config.label = patch.label.trim() || managed.config.label
    if (patch.color !== undefined) managed.config.color = patch.color
    this.emitUpdated()
    this.onState?.()
  }

  /**
   * Remove an account: destroy its view AND clear its partition's session data
   * so the account is truly gone (re-adding requires a fresh login).
   */
  async removeAccount(id: string): Promise<void> {
    const managed = this.views.get(id)
    if (!managed) return

    this.win.contentView.removeChildView(managed.view)
    try {
      ;(managed.view.webContents as unknown as { destroy?: () => void }).destroy?.()
    } catch {
      // already gone
    }
    this.views.delete(id)
    this.order = this.order.filter((x) => x !== id)

    try {
      await session.fromPartition(partitionFor(id)).clearStorageData()
    } catch {
      // best-effort wipe
    }

    if (this.activeId === id) {
      this.activeId = undefined
      const next = this.order[0]
      if (next) this.setActive(next)
    }
    this.emitUpdated()
    this.onState?.()
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

    const startUrl = config.lastUrl ?? config.homeUrl
    const managed: ManagedView = { config, view, currentUrl: startUrl }

    const onNavEvent = (): void => {
      managed.currentUrl = view.webContents.getURL()
      this.onState?.()
      if (this.activeId === config.id) this.emitNav()
    }
    view.webContents.on('did-navigate', onNavEvent)
    view.webContents.on('did-navigate-in-page', (_event, _url, isMainFrame) => {
      if (isMainFrame) onNavEvent()
    })
    view.webContents.on('page-title-updated', () => {
      if (this.activeId === config.id) this.emitNav()
    })

    // Keep popups (auth, "open in new window") in the same account session,
    // never the default session (REQUIREMENTS.md §4.6).
    view.webContents.setWindowOpenHandler(() => ({
      action: 'allow',
      overrideBrowserWindowOptions: {
        webPreferences: {
          partition: partitionFor(config.id),
          contextIsolation: true,
          nodeIntegration: false
        }
      }
    }))

    void view.webContents.loadURL(startUrl)

    this.views.set(config.id, managed)
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
    if (!this.win.isDestroyed()) {
      this.win.webContents.send('accounts:active-changed', id)
    }
    this.emitNav()
    this.onState?.()
  }

  getActiveId(): string | undefined {
    return this.activeId
  }

  private activeWebContents(): WebContents | undefined {
    return this.activeId ? this.views.get(this.activeId)?.view.webContents : undefined
  }

  goBack(): void {
    const wc = this.activeWebContents()
    if (wc?.navigationHistory.canGoBack()) wc.navigationHistory.goBack()
  }

  goForward(): void {
    const wc = this.activeWebContents()
    if (wc?.navigationHistory.canGoForward()) wc.navigationHistory.goForward()
  }

  reload(): void {
    this.activeWebContents()?.reload()
  }

  navigate(url: string): void {
    const target = normalizeUrl(url)
    if (target) void this.activeWebContents()?.loadURL(target)
  }

  getActiveNavState(): NavState | null {
    return this.activeId ? this.navStateFor(this.activeId) : null
  }

  private navStateFor(id: string): NavState {
    const wc = this.views.get(id)!.view.webContents
    return {
      accountId: id,
      url: wc.getURL(),
      canGoBack: wc.navigationHistory.canGoBack(),
      canGoForward: wc.navigationHistory.canGoForward(),
      title: wc.getTitle()
    }
  }

  private emitNav(): void {
    if (this.activeId && !this.win.isDestroyed()) {
      this.win.webContents.send('nav:state', this.navStateFor(this.activeId))
    }
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

  /** Snapshot for persistence: includes each account's latest URL as lastUrl. */
  snapshotAccounts(): PersistedAccount[] {
    return this.order.map((id, index) => {
      const { config, currentUrl } = this.views.get(id)!
      return {
        id: config.id,
        label: config.label,
        color: config.color,
        homeUrl: config.homeUrl,
        lastUrl: currentUrl,
        order: index
      }
    })
  }

  private emitUpdated(): void {
    if (!this.win.isDestroyed()) {
      this.win.webContents.send('accounts:updated', this.summaries())
    }
  }

  /** Re-position the active account view in the area right of the sidebar. */
  private layout(): void {
    const [width, height] = this.win.getContentSize()
    const active = this.activeId ? this.views.get(this.activeId) : undefined
    if (!active) return
    active.view.setBounds({
      x: SIDEBAR_WIDTH,
      y: TOP_BAR_HEIGHT,
      width: Math.max(0, width - SIDEBAR_WIDTH),
      height: Math.max(0, height - TOP_BAR_HEIGHT)
    })
  }
}

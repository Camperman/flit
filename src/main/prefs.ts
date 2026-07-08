import { BrowserWindow, app, nativeTheme } from 'electron'
import type { Prefs, PrefsState } from '../shared/types'
import { DEFAULT_THEME_ID, themeById } from '../shared/themes'

export const DEFAULT_PREFS: Prefs = {
  appearance: 'system',
  themeId: DEFAULT_THEME_ID,
  launchAtLogin: false,
  newTabUrl: 'https://www.google.com',
  searchEngine: 'google',
  downloadsDir: '',
  askWhereToSave: false
}

/**
 * Owns the merged preference state and its side effects (nativeTheme, login
 * item, window background). Persisting and app-specific side effects (new-tab
 * URL, search engine, downloads dir) are wired via the onChange callback.
 */
export class PrefsManager {
  private prefs: Prefs
  private onChange?: (prefs: Prefs) => void

  constructor(saved: Partial<Prefs> | undefined) {
    this.prefs = { ...DEFAULT_PREFS, ...saved }
  }

  /** Register the side-effect hook and apply initial state. */
  start(onChange: (prefs: Prefs) => void): void {
    this.onChange = onChange
    // OS appearance changes (or themeSource updates) re-resolve dark/light.
    nativeTheme.on('updated', () => {
      this.applyWindowBackground()
      this.broadcast()
    })
    this.apply()
  }

  get(): Prefs {
    // Login-item state lives with macOS, not our JSON — read it fresh.
    return { ...this.prefs, launchAtLogin: app.getLoginItemSettings().openAtLogin }
  }

  /** Prefs + resolved appearance, as sent to renderers. */
  state(): PrefsState {
    return { prefs: this.get(), dark: nativeTheme.shouldUseDarkColors }
  }

  set(patch: Partial<Prefs>): void {
    if (patch.launchAtLogin !== undefined) {
      app.setLoginItemSettings({ openAtLogin: patch.launchAtLogin })
    }
    this.prefs = { ...this.prefs, ...patch }
    this.apply()
  }

  /** Persisted snapshot (login item excluded — macOS owns it). */
  snapshot(): Partial<Prefs> {
    const { launchAtLogin: _ignored, ...rest } = this.prefs
    return rest
  }

  /** Window background for the current theme (avoids white flash at launch). */
  windowBackground(): string {
    const colors = themeById(this.prefs.themeId)
    return nativeTheme.shouldUseDarkColors ? colors.dark.bg : colors.light.bg
  }

  private apply(): void {
    nativeTheme.themeSource = this.prefs.appearance
    this.applyWindowBackground()
    this.onChange?.(this.get())
    this.broadcast()
  }

  private broadcast(): void {
    const state = this.state()
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('prefs:changed', state)
    }
  }

  private applyWindowBackground(): void {
    const bg = this.windowBackground()
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.setBackgroundColor(bg)
    }
  }
}

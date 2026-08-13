import { BrowserWindow, app, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'fs'
import { join } from 'path'
import type { UpdateState } from '../shared/types'

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

/** >0 when a is newer than b, 0 when equal, <0 when older. Non-numeric or
 *  missing parts compare as 0, which is fine for our own x.y.z tags. */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.')
  const pb = b.split('.')
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = Number.parseInt(pa[i] ?? '0', 10) || 0
    const nb = Number.parseInt(pb[i] ?? '0', 10) || 0
    if (na !== nb) return na - nb
  }
  return 0
}

/**
 * Reclaim the ~200 MB electron-updater leaves behind after an update installs
 * (the downloaded zip in `pending/`, plus the `update.zip` staging copy it
 * feeds to Squirrel). It can't be cleared when the download finishes: on macOS
 * the install runs *after* we exit, so the zip must survive our quit. The safe
 * moment is a later launch, once the cached version is no longer newer than
 * what's running — then it can only be leftovers. Best-effort; never throws.
 */
export function cleanupStaleUpdateCache(): void {
  // Dev builds report Electron's version from getVersion(), which would make
  // every cached download look stale — and dev never downloads updates anyway,
  // so there is nothing of ours to clean.
  if (!app.isPackaged) return
  try {
    // macOS-only app; Electron 37 dropped 'cache' from getPath().
    const cacheRoot = join(app.getPath('home'), 'Library', 'Caches')
    const dirs = readdirSync(cacheRoot).filter((d) => /^flit-updater$/i.test(d))
    for (const name of dirs) {
      const dir = join(cacheRoot, name)
      const infoPath = join(dir, 'pending', 'update-info.json')
      if (!existsSync(infoPath)) continue
      const info = JSON.parse(readFileSync(infoPath, 'utf8')) as { fileName?: string }
      // No version field in update-info.json — it's in the file name.
      const cached = /-(\d+\.\d+\.\d+)-/.exec(info.fileName ?? '')?.[1]
      if (!cached) continue
      // Newer than us? A download is staged for a future install — leave it.
      if (compareVersions(cached, app.getVersion()) > 0) continue

      let freed = 0
      const staging = join(dir, 'update.zip')
      for (const target of [join(dir, 'pending'), staging]) {
        if (!existsSync(target)) continue
        const s = statSync(target)
        freed += s.isDirectory()
          ? readdirSync(target).reduce((sum, f) => {
              try {
                return sum + statSync(join(target, f)).size
              } catch {
                return sum
              }
            }, 0)
          : s.size
        rmSync(target, { recursive: true, force: true })
      }
      if (freed > 0) {
        console.log(`updater: cleared ${Math.round(freed / 1e6)} MB of stale update cache (v${cached})`)
      }
    }
  } catch {
    // Cache cleanup is never worth interrupting startup for.
  }
}

// True while a user-initiated check/download is in flight, so we surface
// errors loudly (the automatic background checks stay silent — failures there
// are expected on unsigned local builds and before a release has artifacts).
let interactive = false
let lastState: UpdateState = { status: 'idle' }

function broadcast(state: UpdateState): void {
  lastState = state
  const fraction =
    state.status === 'downloading' ? Math.max(0, Math.min(1, (state.percent ?? 0) / 100)) : -1
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    win.setProgressBar(state.status === 'downloading' ? fraction : -1)
    win.webContents.send('update:state', state)
  }
}

export function getUpdateState(): UpdateState {
  return lastState
}

/**
 * True when macOS is running us from a Gatekeeper App Translocation mount —
 * i.e. launched straight from a DMG / still-quarantined download instead of
 * from /Applications. The bundle path is a read-only randomized temp mount, so
 * Squirrel can never replace it: quitAndInstall() silently does nothing. Detect
 * it and say so rather than offering a button that cannot work.
 */
export function isTranslocated(): boolean {
  return app.getPath('exe').includes('/AppTranslocation/')
}

function warnTranslocated(): void {
  void dialog.showMessageBox({
    type: 'warning',
    message: 'Move Flit to your Applications folder to update',
    detail:
      'Flit is running from a temporary read-only location, which macOS uses when an app is opened directly from a disk image or download. Updates can’t install from here.\n\nQuit Flit, drag Flit.app into Applications, then launch it from there.',
    buttons: ['OK']
  })
}

/**
 * Restart and install a downloaded update (the in-app "Restart" affordance and
 * the native prompt's "Restart Now"). Reports failures instead of dying quiet:
 * translocation is explained up front, quitAndInstall throwing is surfaced, and
 * a watchdog catches the case where it neither throws nor quits.
 */
export function restartToUpdate(): void {
  if (!app.isPackaged) return // nothing to install in dev
  if (isTranslocated()) {
    warnTranslocated()
    return
  }
  try {
    autoUpdater.quitAndInstall()
  } catch (error) {
    void dialog.showMessageBox({
      type: 'warning',
      message: 'Couldn’t restart to install the update',
      detail: `${error instanceof Error ? error.message : error}\n\nThe update will install the next time you quit Flit.`
    })
    return
  }
  // quitAndInstall hands off to Squirrel asynchronously and can fail without
  // throwing (unwritable bundle, signature mismatch). If we're still alive a
  // few seconds later, the handoff didn't take — say so.
  setTimeout(() => {
    if (app.isPackaged && BrowserWindow.getAllWindows().length > 0) {
      void dialog.showMessageBox({
        type: 'warning',
        message: 'The update couldn’t be installed automatically',
        detail:
          'Flit is still running, so macOS blocked the in-place update. Install the latest DMG from the Releases page instead — your accounts and settings are untouched.',
        buttons: ['OK']
      })
    }
  }, 5000)
}

/** Menu / Preferences "Check for Updates…": same updater, but with answers —
 *  up-to-date, downloading (with progress), or the error the silent path
 *  swallows. */
export async function checkForUpdatesInteractive(): Promise<void> {
  if (!app.isPackaged) {
    await dialog.showMessageBox({
      type: 'info',
      message: 'Updates are available only in the installed app',
      detail: `This is a development build (v${app.getVersion()}).`
    })
    return
  }
  // Running from a DMG / quarantined download → in-place updates are
  // impossible; explain instead of downloading something we can't install.
  if (isTranslocated()) {
    warnTranslocated()
    return
  }
  // Already downloaded and waiting? Offer the restart straight away.
  if (lastState.status === 'ready') {
    promptRestart(lastState.version)
    return
  }
  interactive = true
  broadcast({ status: 'checking' })
  try {
    const result = await autoUpdater.checkForUpdates()
    if (result?.isUpdateAvailable) {
      broadcast({ status: 'downloading', percent: 0, version: result.updateInfo.version })
      await dialog.showMessageBox({
        type: 'info',
        message: `Flit ${result.updateInfo.version} is downloading`,
        detail:
          'Progress shows in the toolbar and the Dock. You’ll be prompted to restart when it’s ready.'
      })
    } else {
      interactive = false
      broadcast({ status: 'idle' })
      await dialog.showMessageBox({
        type: 'info',
        message: 'You’re up to date',
        detail: `Flit ${app.getVersion()} is the latest version.`
      })
    }
  } catch (error) {
    interactive = false
    broadcast({ status: 'error', message: `${error instanceof Error ? error.message : error}` })
    await dialog.showMessageBox({
      type: 'warning',
      message: 'Couldn’t check for updates',
      detail: `${error instanceof Error ? error.message : error}`
    })
  }
}

let prompted = false
// An update finished downloading, so any later error is an install/restart
// failure the user is actively waiting on — never swallow those.
let downloaded = false
function promptRestart(version?: string): void {
  void dialog
    .showMessageBox({
      type: 'info',
      message: `Flit ${version ?? ''} is ready to install`.replace('  ', ' '),
      detail: 'The update was downloaded. Restart to finish installing.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1
    })
    .then(({ response }) => {
      // Route through restartToUpdate so the translocation check, throw
      // handling, and did-it-actually-quit watchdog apply here too.
      if (response === 0) restartToUpdate()
      // "Later" → installs automatically on next quit.
    })
}

/**
 * Auto-update from GitHub Releases (Camperman/flit, public — no token needed
 * to download). Checks shortly after launch and every few hours; downloads in
 * the background with progress feedback, and offers a restart when ready.
 * No-ops in dev and for unsigned local builds (updates require a valid
 * signature). Errors are surfaced only when the user asked (interactive).
 */
export function startAutoUpdate(): void {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    broadcast({ status: 'downloading', percent: 0, version: info.version })
  })

  autoUpdater.on('download-progress', (p) => {
    broadcast({ status: 'downloading', percent: p.percent, version: lastState.version })
  })

  autoUpdater.on('update-downloaded', (info) => {
    interactive = false
    downloaded = true
    broadcast({ status: 'ready', version: info.version })
    if (prompted) return
    prompted = true
    promptRestart(info.version)
  })

  autoUpdater.on('error', (err) => {
    // Surface when the user is waiting on us: an explicit check (interactive)
    // OR anything that goes wrong once an update is downloaded — that's the
    // install/restart path failing, which used to die silently and look like a
    // dead button. Only pre-download background failures stay quiet (expected
    // on unsigned local builds and before a release has artifacts).
    const loud = interactive || downloaded
    broadcast({ status: loud ? 'error' : 'idle', message: `${err?.message ?? err}` })
    if (!loud) return
    interactive = false
    void dialog.showMessageBox({
      type: 'warning',
      message: downloaded ? 'Couldn’t install the update' : 'Update failed',
      detail: `${err?.message ?? err}${
        downloaded
          ? '\n\nYou can install the latest DMG from the Releases page instead — your accounts and settings are untouched.'
          : ''
      }`
    })
  })

  const check = (): void => {
    autoUpdater.checkForUpdates().catch(() => {})
  }
  setTimeout(check, 15_000) // let launch settle first
  const timer = setInterval(check, CHECK_INTERVAL_MS)
  timer.unref?.()
}

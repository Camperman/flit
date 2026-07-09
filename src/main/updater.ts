import { app, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

/** Menu / Preferences "Check for Updates…": same updater, but with answers —
 *  up-to-date, downloading, or the error the silent path swallows. */
export async function checkForUpdatesInteractive(): Promise<void> {
  if (!app.isPackaged) {
    await dialog.showMessageBox({
      type: 'info',
      message: 'Updates are available only in the installed app',
      detail: `This is a development build (v${app.getVersion()}).`
    })
    return
  }
  try {
    const result = await autoUpdater.checkForUpdates()
    if (result?.isUpdateAvailable) {
      await dialog.showMessageBox({
        type: 'info',
        message: `Flit ${result.updateInfo.version} is available`,
        detail: 'Downloading in the background — you’ll be prompted to restart when it’s ready.'
      })
    } else {
      await dialog.showMessageBox({
        type: 'info',
        message: 'You’re up to date',
        detail: `Flit ${app.getVersion()} is the latest version.`
      })
    }
  } catch (error) {
    await dialog.showMessageBox({
      type: 'warning',
      message: 'Couldn’t check for updates',
      detail: `${error instanceof Error ? error.message : error}`
    })
  }
}

/**
 * Auto-update from GitHub Releases (Camperman/flit, public — no token
 * needed to download). Checks shortly after launch and every few hours;
 * downloads in the background and offers a restart when ready. No-ops in
 * dev and for unsigned local builds (updates require a valid signature).
 */
export function startAutoUpdate(): void {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  // Expected until a release carries update artifacts (zip + latest-mac.yml),
  // and for unsigned local `npm run package` builds — never bother the user.
  autoUpdater.on('error', () => {})

  let prompted = false
  autoUpdater.on('update-downloaded', (info) => {
    if (prompted) return
    prompted = true
    void dialog
      .showMessageBox({
        type: 'info',
        message: `Flit ${info.version} is ready to install`,
        detail: 'The update was downloaded in the background.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
        cancelId: 1
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall()
        // "Later" → installs automatically on next quit.
      })
  })

  const check = (): void => {
    autoUpdater.checkForUpdates().catch(() => {})
  }
  setTimeout(check, 15_000) // let launch settle first
  const timer = setInterval(check, CHECK_INTERVAL_MS)
  timer.unref?.()
}

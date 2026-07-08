import { BrowserWindow, app, shell, type DownloadItem, type Session } from 'electron'
import { randomUUID } from 'crypto'
import { existsSync } from 'fs'
import { basename, extname, join } from 'path'
import type { DownloadInfo } from '../shared/types'

/** Keep at most this many finished entries in the session list. */
const MAX_FINISHED = 20

/** `report.pdf` → `report (2).pdf` until the name is free in ~/Downloads. */
function uniquePath(dir: string, filename: string): string {
  const ext = extname(filename)
  const stem = filename.slice(0, filename.length - ext.length)
  let candidate = join(dir, filename)
  for (let n = 1; existsSync(candidate); n++) {
    candidate = join(dir, `${stem} (${n})${ext}`)
  }
  return candidate
}

/**
 * Chrome-style download handling: every download saves straight to
 * ~/Downloads (uniquified, no save dialog), progress is broadcast to all
 * windows for the top-bar panel, and the dock icon shows aggregate progress.
 */
export class DownloadManager {
  private readonly items = new Map<string, DownloadItem>()
  private downloads: DownloadInfo[] = []

  /** Wire a session's downloads (called once per account partition). */
  attach(ses: Session, accountId: string): void {
    ses.on('will-download', (_event, item) => this.track(item, accountId))
  }

  private track(item: DownloadItem, accountId: string): void {
    const savePath = uniquePath(app.getPath('downloads'), item.getFilename())
    item.setSavePath(savePath)

    const info: DownloadInfo = {
      id: randomUUID(),
      filename: basename(savePath),
      path: savePath,
      accountId,
      totalBytes: item.getTotalBytes(),
      receivedBytes: 0,
      state: 'progressing',
      startedAt: Date.now()
    }
    this.items.set(info.id, item)
    this.downloads.unshift(info)

    item.on('updated', (_e, state) => {
      info.receivedBytes = item.getReceivedBytes()
      info.totalBytes = item.getTotalBytes()
      info.state = state === 'interrupted' ? 'interrupted' : item.isPaused() ? 'paused' : 'progressing'
      this.emit()
    })
    item.once('done', (_e, state) => {
      info.receivedBytes = item.getReceivedBytes()
      info.state = state === 'completed' ? 'completed' : state === 'cancelled' ? 'cancelled' : 'interrupted'
      this.items.delete(info.id)
      this.trimFinished()
      this.emit()
      if (info.state === 'completed') app.dock?.bounce('informational')
    })
    this.emit()
  }

  private trimFinished(): void {
    const finished = this.downloads.filter((d) => d.state !== 'progressing' && d.state !== 'paused')
    for (const extra of finished.slice(MAX_FINISHED)) {
      this.downloads = this.downloads.filter((d) => d.id !== extra.id)
    }
  }

  /** Push the list to every window and update the dock progress bar. */
  private emit(): void {
    const active = this.downloads.filter((d) => d.state === 'progressing' || d.state === 'paused')
    const total = active.reduce((sum, d) => sum + d.totalBytes, 0)
    const received = active.reduce((sum, d) => sum + d.receivedBytes, 0)
    // -1 clears; indeterminate (2) when sizes are unknown.
    const progress = active.length === 0 ? -1 : total > 0 ? received / total : 2
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue
      win.setProgressBar(progress)
      win.webContents.send('downloads:state', this.downloads)
    }
  }

  list(): DownloadInfo[] {
    return this.downloads
  }

  open(id: string): void {
    const info = this.downloads.find((d) => d.id === id)
    if (info?.state === 'completed') void shell.openPath(info.path)
  }

  show(id: string): void {
    const info = this.downloads.find((d) => d.id === id)
    if (info && existsSync(info.path)) shell.showItemInFolder(info.path)
  }

  cancel(id: string): void {
    this.items.get(id)?.cancel()
  }

  /** Drop finished/cancelled/interrupted entries; active ones stay. */
  clear(): void {
    this.downloads = this.downloads.filter(
      (d) => d.state === 'progressing' || d.state === 'paused'
    )
    this.emit()
  }
}

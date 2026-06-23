import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { AccountManager } from './accounts'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Glide',
    show: false,
    backgroundColor: '#1b1d22',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  // electron-vite injects the dev server URL in development; load the built
  // file in production / packaged runs. The React renderer is the base layer
  // (sidebar + chrome); account WebContentsViews are overlaid on top of it.
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Phase 1: one isolated account view loading Gmail. Phase 2 makes this
  // multiple accounts driven by the sidebar.
  const accounts = new AccountManager(mainWindow)
  accounts.createAccount('default', 'https://mail.google.com')
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

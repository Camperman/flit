import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { AccountManager, type AccountConfig } from './accounts'
import { registerIpc } from './ipc'

// Phase 2: hardcoded seed accounts. Phase 3 loads these from disk; Phase 4
// lets the user add/remove them from the UI.
const SEED_ACCOUNTS: AccountConfig[] = [
  { id: 'one', label: 'One', color: '#4c8bf5', url: 'https://mail.google.com' },
  { id: 'two', label: 'Two', color: '#34a853', url: 'https://mail.google.com' },
  { id: 'three', label: 'Three', color: '#ea4335', url: 'https://mail.google.com' }
]

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

  // Multiple isolated account views, switchable from the sidebar.
  const accounts = new AccountManager(mainWindow)
  registerIpc(accounts)
  accounts.load(SEED_ACCOUNTS)
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

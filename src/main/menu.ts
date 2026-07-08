import { Menu, type MenuItemConstructorOptions } from 'electron'
import type { AppRailLayout } from '../shared/types'

export interface MenuHandlers {
  newWindow: () => void
  openPreferences: () => void
  setDefaultBrowser: () => void
  switchToIndex: (index: number) => void
  zoomIn: () => void
  zoomOut: () => void
  zoomReset: () => void
  setLayout: (layout: AppRailLayout) => void
  layout: AppRailLayout
  bookmarksBar: boolean
  toggleBookmarksBar: () => void
  importBookmarks: () => void
}

/**
 * Install the application menu. Besides standard roles (so Cmd-C/V/etc. keep
 * working in the web views), it adds Cmd-1 … Cmd-9 to switch accounts, Cmd +/-/0
 * to zoom the active page, and an App Layout toggle (left rail vs top row).
 * Rebuild it (call again) when the layout changes so the radio check updates.
 */
export function buildAppMenu(handlers: MenuHandlers): void {
  const accountItems: MenuItemConstructorOptions[] = Array.from({ length: 9 }, (_, i) => ({
    label: `Switch to Account ${i + 1}`,
    accelerator: `CommandOrControl+${i + 1}`,
    click: () => handlers.switchToIndex(i)
  }))

  // Custom app menu: same as the stock appMenu role, plus Preferences… (Cmd-,).
  const appMenu: MenuItemConstructorOptions = {
    role: 'appMenu',
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      {
        label: 'Preferences…',
        accelerator: 'Command+,',
        click: () => handlers.openPreferences()
      },
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' }
    ]
  }

  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [appMenu] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Window',
          accelerator: 'CommandOrControl+N',
          click: () => handlers.newWindow()
        },
        { type: 'separator' },
        {
          label: 'Set as Default Browser…',
          click: () => handlers.setDefaultBrowser()
        }
      ]
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { label: 'Zoom In', accelerator: 'CommandOrControl+=', click: handlers.zoomIn },
        { label: 'Zoom Out', accelerator: 'CommandOrControl+-', click: handlers.zoomOut },
        { label: 'Actual Size', accelerator: 'CommandOrControl+0', click: handlers.zoomReset },
        { type: 'separator' },
        {
          label: 'App Layout',
          submenu: [
            {
              label: 'Left Rail',
              type: 'radio',
              checked: handlers.layout === 'left',
              click: () => handlers.setLayout('left')
            },
            {
              label: 'Top Right',
              type: 'radio',
              checked: handlers.layout === 'top',
              click: () => handlers.setLayout('top')
            }
          ]
        }
      ]
    },
    {
      label: 'Bookmarks',
      submenu: [
        {
          label: 'Show Bookmarks Bar',
          type: 'checkbox',
          checked: handlers.bookmarksBar,
          accelerator: 'CommandOrControl+Shift+B',
          click: () => handlers.toggleBookmarksBar()
        },
        { type: 'separator' },
        { label: 'Import from Chrome…', click: () => handlers.importBookmarks() }
      ]
    },
    { label: 'Accounts', submenu: accountItems },
    { role: 'windowMenu' }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

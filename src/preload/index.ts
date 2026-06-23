import { contextBridge, ipcRenderer } from 'electron'
import type { GlideApi } from '../shared/types'

// Typed, minimal bridge exposed to the renderer. The renderer holds no session
// state — it sends intents to main and renders state pushed back.
const api: GlideApi = {
  listAccounts: () => ipcRenderer.invoke('accounts:list'),
  getActive: () => ipcRenderer.invoke('accounts:active'),
  switchAccount: (id) => ipcRenderer.invoke('accounts:switch', id),
  onActiveChanged: (cb) => {
    const listener = (_event: unknown, id: string): void => cb(id)
    ipcRenderer.on('accounts:active-changed', listener)
    return () => ipcRenderer.removeListener('accounts:active-changed', listener)
  },
  __test: {
    partitions: () => ipcRenderer.invoke('__test:partitions'),
    setCookie: (arg) => ipcRenderer.invoke('__test:set-cookie', arg),
    getCookies: (arg) => ipcRenderer.invoke('__test:get-cookies', arg)
  }
}

contextBridge.exposeInMainWorld('glide', api)

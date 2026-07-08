"use strict";
const electron = require("electron");
const crypto = require("crypto");
const path = require("path");
const child_process = require("child_process");
const fs = require("fs");
const os = require("os");
const CHROME_DIR = path.join(os.homedir(), "Library", "Application Support", "Google", "Chrome");
function countLinks(nodes) {
  let n = 0;
  for (const node of nodes) {
    if (node.type === "url") n++;
    else if (node.children) n += countLinks(node.children);
  }
  return n;
}
function listChromeProfiles() {
  if (!fs.existsSync(CHROME_DIR)) return [];
  const names = {};
  try {
    const localState = JSON.parse(fs.readFileSync(path.join(CHROME_DIR, "Local State"), "utf8"));
    const cache = localState?.profile?.info_cache ?? {};
    for (const key of Object.keys(cache)) names[key] = cache[key]?.name ?? key;
  } catch {
  }
  const profiles = [];
  for (const entry of fs.readdirSync(CHROME_DIR)) {
    const bookmarksPath = path.join(CHROME_DIR, entry, "Bookmarks");
    if (!fs.existsSync(bookmarksPath)) continue;
    let count = 0;
    try {
      const data = JSON.parse(fs.readFileSync(bookmarksPath, "utf8"));
      count = countLinks(data?.roots?.bookmark_bar?.children ?? []);
    } catch {
    }
    profiles.push({ dir: entry, name: names[entry] ?? entry, count });
  }
  return profiles.sort((a, b) => b.count - a.count);
}
function convert(nodes) {
  const out = [];
  for (const node of nodes) {
    if (node.type === "url" && node.url) {
      out.push({ type: "link", id: crypto.randomUUID(), title: node.name || node.url, url: node.url });
    } else if (node.type === "folder") {
      out.push({
        type: "folder",
        id: crypto.randomUUID(),
        title: node.name || "Folder",
        children: convert(node.children ?? [])
      });
    }
  }
  return out;
}
function readChromeBookmarkBar(dir) {
  const data = JSON.parse(fs.readFileSync(path.join(CHROME_DIR, dir, "Bookmarks"), "utf8"));
  return convert(data?.roots?.bookmark_bar?.children ?? []);
}
const SIDEBAR_WIDTH = 64;
const APP_RAIL_WIDTH = 84;
const TITLE_BAR_HEIGHT = 38;
const TOP_BAR_HEIGHT = 44;
const BOOKMARKS_BAR_HEIGHT = 36;
const CONTENT_INSET = 8;
const CONTENT_RADIUS = 10;
const NEW_TAB_URL = "https://www.google.com";
const DISCARD_IDLE_MS = 30 * 60 * 1e3;
const DISCARD_SWEEP_MS = 5 * 60 * 1e3;
function defaultShortcuts() {
  return [
    { label: "Mail", url: "https://mail.google.com" },
    { label: "Calendar", url: "https://calendar.google.com" },
    { label: "Drive", url: "https://drive.google.com" },
    { label: "Docs", url: "https://docs.google.com" },
    { label: "Sheets", url: "https://sheets.google.com" },
    { label: "Meet", url: "https://meet.google.com" },
    { label: "Contacts", url: "https://contacts.google.com" },
    { label: "Passwords", url: "https://passwords.google.com" }
  ].map((s) => ({ id: crypto.randomUUID(), ...s }));
}
const GRANTED_PERMISSIONS = /* @__PURE__ */ new Set([
  "notifications",
  "media",
  "mediaKeySystem",
  "clipboard-read",
  "clipboard-sanitized-write",
  "fullscreen",
  "pointerLock"
]);
const AVATAR_SCRIPT = `(() => {
  const sels = [
    'a[aria-label*="Google Account"] img',
    'a[href^="https://accounts.google.com/SignOutOptions"] img',
    'img.gbii', 'img.gb_P'
  ]
  for (const s of sels) {
    const el = document.querySelector(s)
    if (el && el.src && el.src.indexOf('http') === 0) return el.src
  }
  return null
})()`;
function partitionFor(id) {
  return `persist:account-${id}`;
}
function normalizeUrl(url) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
function resolveQuery(input) {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  const looksLikeUrl = !/\s/.test(trimmed) && (/^localhost(:\d+)?(\/.*)?$/i.test(trimmed) || /^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/.*)?$/.test(trimmed) || /^[^\s/.]+\.[^\s/.]+/.test(trimmed));
  if (looksLikeUrl) return `https://${trimmed}`;
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}
function parseUnread(title) {
  const match = title.match(/\((\d+)\)/);
  return match ? parseInt(match[1], 10) : 0;
}
function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}
function isExternalProtocol(url) {
  const match = /^([a-z][a-z0-9+.-]*):/i.exec(url);
  if (!match) return false;
  const scheme = match[1].toLowerCase();
  return !["http", "https", "about", "blob", "data", "file", "chrome", "devtools", "filesystem"].includes(
    scheme
  );
}
const KNOWN_BROWSERS = [
  { label: "Safari", app: "Safari" },
  { label: "Google Chrome", app: "Google Chrome" },
  { label: "Google Chrome Canary", app: "Google Chrome Canary" },
  { label: "Microsoft Edge", app: "Microsoft Edge" },
  { label: "Firefox", app: "Firefox" },
  { label: "Brave Browser", app: "Brave Browser" },
  { label: "Arc", app: "Arc" },
  { label: "Opera", app: "Opera" },
  { label: "Vivaldi", app: "Vivaldi" }
];
let installedBrowsersCache;
function installedBrowsers() {
  if (installedBrowsersCache) return installedBrowsersCache;
  const roots = ["/Applications", `${os.homedir()}/Applications`];
  installedBrowsersCache = KNOWN_BROWSERS.filter(
    (b) => roots.some((root) => fs.existsSync(`${root}/${b.app}.app`))
  );
  return installedBrowsersCache;
}
function openInBrowser(app, url) {
  if (!/^https?:\/\//i.test(url)) return;
  child_process.execFile("open", ["-a", app, url], () => {
  });
}
function findFolder(nodes, id) {
  for (const node of nodes) {
    if (node.type === "folder") {
      if (node.id === id) return node;
      const nested = findFolder(node.children, id);
      if (nested) return nested;
    }
  }
  return void 0;
}
class AccountManager {
  onState;
  accounts = /* @__PURE__ */ new Map();
  order = [];
  windows = /* @__PURE__ */ new Map();
  zoomFactor = 1;
  railLayout = "left";
  bookmarksBar = false;
  constructor(onState) {
    this.onState = onState;
    const timer = setInterval(() => this.discardIdle(), DISCARD_SWEEP_MS);
    timer.unref?.();
  }
  // ---- metadata loading -------------------------------------------------
  loadMetadata(configs) {
    for (const config of configs) this.addMeta(config);
  }
  addMeta(config) {
    const ses = electron.session.fromPartition(partitionFor(config.id));
    ses.setPermissionRequestHandler(
      (_wc, permission, callback) => callback(GRANTED_PERMISSIONS.has(permission))
    );
    ses.setPermissionCheckHandler((_wc, permission) => GRANTED_PERMISSIONS.has(permission));
    ses.setDisplayMediaRequestHandler(
      (_request, callback) => {
        electron.desktopCapturer.getSources({ types: ["screen", "window"] }).then((sources) => callback(sources.length ? { video: sources[0] } : {})).catch(() => callback({}));
      },
      { useSystemPicker: true }
    );
    const meta = {
      id: config.id,
      label: config.label,
      color: config.color,
      homeUrl: config.homeUrl,
      lastUrl: config.lastUrl ?? config.homeUrl,
      shortcuts: config.shortcuts && config.shortcuts.length > 0 ? config.shortcuts : defaultShortcuts(),
      bookmarks: config.bookmarks ?? [],
      avatarUrl: config.avatarUrl
    };
    this.accounts.set(meta.id, meta);
    if (!this.order.includes(meta.id)) this.order.push(meta.id);
    return meta;
  }
  // ---- window lifecycle -------------------------------------------------
  /** Register a new BrowserWindow: build its views and wire its handlers. */
  registerWindow(win, defaultActiveId) {
    const eager = this.windows.size === 0;
    const ws = { win, overlayOpen: false, perAccount: /* @__PURE__ */ new Map() };
    this.windows.set(win.id, ws);
    win.on("resize", () => this.layout(ws));
    win.on("closed", () => this.unregisterWindow(win.id));
    if (eager) {
      for (const id of this.order) this.ensureLoaded(ws, id);
    }
    const initial = defaultActiveId && this.accounts.has(defaultActiveId) ? defaultActiveId : this.order[0];
    if (initial) this.setActive(win, initial);
  }
  unregisterWindow(winId) {
    const ws = this.windows.get(winId);
    if (!ws) return;
    for (const wa of ws.perAccount.values()) {
      for (const tab of wa.tabs) if (tab.view) this.destroyView(ws, tab.view);
    }
    this.windows.delete(winId);
  }
  wsFor(win) {
    return this.windows.get(win.id);
  }
  allWindows() {
    return [...this.windows.values()];
  }
  // ---- per-window tab/view management -----------------------------------
  accountState(ws, accountId) {
    let wa = ws.perAccount.get(accountId);
    if (!wa) {
      wa = { tabs: [], activeTabId: void 0, unreadByApp: {} };
      ws.perAccount.set(accountId, wa);
    }
    return wa;
  }
  /** Ensure this window has at least the account's initial tab loaded. */
  ensureLoaded(ws, accountId) {
    const meta = this.accounts.get(accountId);
    if (!meta) return;
    const wa = this.accountState(ws, accountId);
    if (wa.tabs.length > 0) return;
    const restoreUrl = meta.lastUrl || meta.homeUrl;
    const origin = meta.shortcuts.find((s) => hostOf(s.url) === hostOf(restoreUrl))?.id;
    const tab = this.openTab(ws, accountId, restoreUrl, origin);
    wa.activeTabId = tab.id;
  }
  openTab(ws, accountId, url, originShortcutId) {
    const tab = {
      id: crypto.randomUUID(),
      currentUrl: url,
      title: "",
      originShortcutId,
      lastActive: Date.now()
    };
    this.createView(ws, accountId, tab);
    this.accountState(ws, accountId).tabs.push(tab);
    return tab;
  }
  /** Build (or rebuild, after a discard) the live view for a tab record. */
  createView(ws, accountId, tab) {
    const part = partitionFor(accountId);
    const view = new electron.WebContentsView({
      webPreferences: { partition: part, contextIsolation: true, nodeIntegration: false }
    });
    view.setBackgroundColor("#ffffff");
    view.setBorderRadius(CONTENT_RADIUS);
    const wc = view.webContents;
    tab.view = view;
    const isActiveTab = () => ws.activeAccountId === accountId && this.accountState(ws, accountId).activeTabId === tab.id;
    wc.on("did-finish-load", () => {
      wc.setZoomFactor(this.zoomFactor);
      this.extractAvatar(accountId, wc);
      setTimeout(() => this.extractAvatar(accountId, wc), 2e3);
    });
    const onNav = () => {
      tab.currentUrl = wc.getURL();
      const meta = this.accounts.get(accountId);
      if (meta) meta.lastUrl = tab.currentUrl;
      this.onState?.();
      if (isActiveTab()) this.emitNav(ws);
    };
    wc.on("did-navigate", onNav);
    wc.on("did-navigate-in-page", (_e, _u, isMainFrame) => {
      if (isMainFrame) onNav();
    });
    wc.on("page-title-updated", (_e, title) => {
      tab.title = title;
      const wa = this.accountState(ws, accountId);
      if (tab.originShortcutId) {
        const count = parseUnread(title);
        if (wa.unreadByApp[tab.originShortcutId] !== count) {
          wa.unreadByApp[tab.originShortcutId] = count;
          this.emitUnread(ws, accountId);
          if (ws.activeAccountId === accountId) this.emitApps(ws, accountId);
        }
      }
      if (ws.activeAccountId === accountId) this.emitTabs(ws, accountId);
      if (isActiveTab()) this.emitNav(ws);
    });
    wc.on("page-favicon-updated", (_e, favicons) => {
      const icon = favicons[0];
      if (!icon || icon === tab.favicon) return;
      tab.favicon = icon;
      if (tab.originShortcutId) {
        const meta = this.accounts.get(accountId);
        const shortcut = meta?.shortcuts.find((s) => s.id === tab.originShortcutId);
        if (shortcut && shortcut.favicon !== icon) {
          shortcut.favicon = icon;
          this.onState?.();
          this.broadcastShortcuts(accountId);
        }
      }
      if (ws.activeAccountId === accountId) {
        this.emitTabs(ws, accountId);
        this.emitApps(ws, accountId);
      }
    });
    wc.setWindowOpenHandler(({ url, disposition }) => {
      if (isExternalProtocol(url)) {
        void electron.shell.openExternal(url).catch(() => {
        });
        return { action: "deny" };
      }
      if (disposition === "foreground-tab" || disposition === "background-tab") {
        this.openLinkTab(ws, accountId, url, disposition === "background-tab");
        return { action: "deny" };
      }
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          webPreferences: { partition: part, contextIsolation: true, nodeIntegration: false }
        }
      };
    });
    wc.on("context-menu", (_e, params) => {
      const items = [];
      const link = params.linkURL;
      if (link) {
        items.push(
          { label: "Open Link in New Tab", click: () => this.openLinkTab(ws, accountId, link, false) },
          { label: "Open Link in New Window", click: () => this.openLinkInNewWindow(accountId, link) }
        );
        const browsers = installedBrowsers();
        if (browsers.length > 0) {
          items.push({
            label: "Open Link in Browser",
            submenu: browsers.map((b) => ({
              label: b.label,
              click: () => openInBrowser(b.app, link)
            }))
          });
        }
        items.push(
          { label: "Copy Link", click: () => electron.clipboard.writeText(link) },
          { type: "separator" }
        );
      }
      if (params.isEditable) {
        items.push({ role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" });
      } else if (params.selectionText) {
        items.push({ role: "copy" });
      }
      if (items.length === 0) {
        items.push(
          {
            label: "Back",
            enabled: wc.navigationHistory.canGoBack(),
            click: () => wc.navigationHistory.goBack()
          },
          { label: "Reload", click: () => wc.reload() }
        );
      }
      electron.Menu.buildFromTemplate(items).popup({ window: ws.win });
    });
    wc.on("did-create-window", (child) => {
      let sawAuth = false;
      const check = (_e, navUrl) => {
        if (navUrl.includes("accounts.google.com")) sawAuth = true;
      };
      child.webContents.on("did-navigate", check);
      child.webContents.on("did-navigate-in-page", check);
      child.on("closed", () => {
        if (sawAuth && !wc.isDestroyed()) wc.reload();
      });
    });
    wc.on("will-navigate", (e, url) => {
      if (isExternalProtocol(url)) {
        e.preventDefault();
        void electron.shell.openExternal(url).catch(() => {
        });
      }
    });
    view.setVisible(false);
    ws.win.contentView.addChildView(view);
    void wc.loadURL(tab.currentUrl);
  }
  /** Ensure the active tab has a live view (rebuild if discarded) and mark used. */
  materializeActive(ws) {
    if (!ws.activeAccountId) return;
    const wa = ws.perAccount.get(ws.activeAccountId);
    if (!wa?.activeTabId) return;
    const tab = wa.tabs.find((t) => t.id === wa.activeTabId);
    if (!tab) return;
    if (!tab.view) this.createView(ws, ws.activeAccountId, tab);
    tab.lastActive = Date.now();
  }
  /** Unload background views idle longer than the threshold to reclaim memory. */
  discardIdle() {
    const now = Date.now();
    for (const ws of this.allWindows()) {
      const visibleTabId = ws.activeAccountId ? ws.perAccount.get(ws.activeAccountId)?.activeTabId : void 0;
      for (const [accountId, wa] of ws.perAccount) {
        for (const tab of wa.tabs) {
          const visible = accountId === ws.activeAccountId && tab.id === visibleTabId;
          if (visible) {
            tab.lastActive = now;
            continue;
          }
          if (tab.view && now - tab.lastActive > DISCARD_IDLE_MS) {
            this.destroyView(ws, tab.view);
            tab.view = void 0;
          }
        }
      }
    }
  }
  newTab(win, accountId) {
    const ws = this.wsFor(win);
    if (!ws) return;
    const tab = this.openTab(ws, accountId, NEW_TAB_URL);
    this.accountState(ws, accountId).activeTabId = tab.id;
    this.afterTabChange(ws, accountId);
  }
  /** Open a clicked link as a tab (foreground unless it's a background-tab open). */
  openLinkTab(ws, accountId, url, background) {
    const tab = this.openTab(ws, accountId, url);
    if (!background) this.accountState(ws, accountId).activeTabId = tab.id;
    this.afterTabChange(ws, accountId);
  }
  /** Open a link in its own bare window (right-click → Open in New Window). */
  openLinkInNewWindow(accountId, url) {
    const win = new electron.BrowserWindow({
      width: 1e3,
      height: 760,
      webPreferences: {
        partition: partitionFor(accountId),
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    void win.loadURL(url);
  }
  activateTab(win, accountId, tabId) {
    const ws = this.wsFor(win);
    if (!ws) return;
    const wa = this.accountState(ws, accountId);
    if (!wa.tabs.some((t) => t.id === tabId)) return;
    wa.activeTabId = tabId;
    this.afterTabChange(ws, accountId);
  }
  reorderTabs(win, accountId, tabIds) {
    const ws = this.wsFor(win);
    if (!ws) return;
    const wa = this.accountState(ws, accountId);
    const byId = new Map(wa.tabs.map((t) => [t.id, t]));
    const next = [];
    for (const id of tabIds) {
      const tab = byId.get(id);
      if (tab) next.push(tab);
    }
    for (const tab of wa.tabs) if (!tabIds.includes(tab.id)) next.push(tab);
    if (next.length !== wa.tabs.length) return;
    wa.tabs = next;
    this.emitTabs(ws, accountId);
  }
  closeTab(win, accountId, tabId) {
    const ws = this.wsFor(win);
    if (!ws) return;
    const wa = this.accountState(ws, accountId);
    const index = wa.tabs.findIndex((t) => t.id === tabId);
    if (index === -1) return;
    const view = wa.tabs[index].view;
    if (view) this.destroyView(ws, view);
    wa.tabs.splice(index, 1);
    if (wa.activeTabId === tabId) {
      const neighbour = wa.tabs[index] ?? wa.tabs[index - 1];
      wa.activeTabId = neighbour?.id;
    }
    this.afterTabChange(ws, accountId);
  }
  openShortcut(win, accountId, shortcutId) {
    const ws = this.wsFor(win);
    const meta = this.accounts.get(accountId);
    if (!ws || !meta) return;
    const shortcut = meta.shortcuts.find((s) => s.id === shortcutId);
    if (!shortcut) return;
    const wa = this.accountState(ws, accountId);
    const existing = wa.tabs.find((t) => t.originShortcutId === shortcutId);
    if (existing) {
      wa.activeTabId = existing.id;
    } else {
      const tab = this.openTab(ws, accountId, shortcut.url, shortcutId);
      wa.activeTabId = tab.id;
    }
    this.afterTabChange(ws, accountId);
  }
  afterTabChange(ws, accountId) {
    if (ws.activeAccountId === accountId) {
      this.refreshVisibility(ws);
      this.layout(ws);
      this.emitNav(ws);
      this.emitApps(ws, accountId);
    }
    this.emitTabs(ws, accountId);
    this.onState?.();
  }
  destroyView(ws, view) {
    try {
      ws.win.contentView.removeChildView(view);
    } catch {
    }
    try {
      ;
      view.webContents.destroy?.();
    } catch {
    }
  }
  // ---- account metadata mutations (broadcast to all windows) ------------
  addAccount(input) {
    const id = crypto.randomUUID();
    this.addMeta({
      id,
      label: input.label.trim() || "Account",
      color: input.color || "#888888",
      homeUrl: normalizeUrl(input.homeUrl) || "https://mail.google.com"
    });
    for (const ws of this.allWindows()) {
      this.ensureLoaded(ws, id);
      this.setActiveWs(ws, id);
    }
    this.broadcastUpdated();
    this.onState?.();
    return id;
  }
  updateAccount(id, patch) {
    const meta = this.accounts.get(id);
    if (!meta) return;
    if (patch.label !== void 0) meta.label = patch.label.trim() || meta.label;
    if (patch.color !== void 0) meta.color = patch.color;
    this.broadcastUpdated();
    this.onState?.();
  }
  async removeAccount(id) {
    if (!this.accounts.has(id)) return;
    for (const ws of this.allWindows()) {
      const wa = ws.perAccount.get(id);
      if (wa) {
        for (const tab of wa.tabs) if (tab.view) this.destroyView(ws, tab.view);
        ws.perAccount.delete(id);
      }
      if (ws.activeAccountId === id) {
        ws.activeAccountId = void 0;
        const next = this.order.find((x) => x !== id);
        if (next) this.setActiveWs(ws, next);
      }
    }
    this.accounts.delete(id);
    this.order = this.order.filter((x) => x !== id);
    try {
      await electron.session.fromPartition(partitionFor(id)).clearStorageData();
    } catch {
    }
    this.broadcastUpdated();
    this.onState?.();
  }
  // ---- active account (per window) --------------------------------------
  setActive(win, id) {
    const ws = this.wsFor(win);
    if (!ws) return;
    this.setActiveWs(ws, id);
  }
  setActiveWs(ws, id) {
    if (!this.accounts.has(id)) return;
    this.ensureLoaded(ws, id);
    ws.activeAccountId = id;
    this.refreshVisibility(ws);
    this.layout(ws);
    if (!ws.win.isDestroyed()) ws.win.webContents.send("accounts:active-changed", id);
    this.emitNav(ws);
    this.emitTabs(ws, id);
    this.emitApps(ws, id);
    this.onState?.();
  }
  getActiveId(win) {
    return this.wsFor(win)?.activeAccountId;
  }
  setActiveByIndex(win, index) {
    const id = this.order[index];
    if (id) this.setActive(win, id);
  }
  setOverlayOpen(win, open) {
    const ws = this.wsFor(win);
    if (!ws) return;
    ws.overlayOpen = open;
    this.refreshVisibility(ws);
  }
  // ---- settings (global, applied to all windows) ------------------------
  getZoom() {
    return this.zoomFactor;
  }
  setZoom(factor) {
    this.zoomFactor = Math.round(Math.min(3, Math.max(0.3, factor)) * 100) / 100;
    for (const ws of this.allWindows()) {
      for (const wa of ws.perAccount.values()) {
        for (const tab of wa.tabs) tab.view?.webContents.setZoomFactor(this.zoomFactor);
      }
    }
    this.onState?.();
  }
  zoomIn() {
    this.setZoom(this.zoomFactor + 0.1);
  }
  zoomOut() {
    this.setZoom(this.zoomFactor - 0.1);
  }
  zoomReset() {
    this.setZoom(1);
  }
  getLayout() {
    return this.railLayout;
  }
  setLayout(layout) {
    this.railLayout = layout;
    for (const ws of this.allWindows()) {
      this.layout(ws);
      if (!ws.win.isDestroyed()) ws.win.webContents.send("layout:changed", layout);
    }
    this.onState?.();
  }
  getBookmarksBarVisible() {
    return this.bookmarksBar;
  }
  setBookmarksBarVisible(visible) {
    this.bookmarksBar = visible;
    for (const ws of this.allWindows()) {
      this.layout(ws);
      if (!ws.win.isDestroyed()) ws.win.webContents.send("bookmarks:visible", visible);
    }
    this.onState?.();
  }
  // ---- bookmarks (metadata; folders open per-window) --------------------
  getBookmarks(accountId) {
    return this.accounts.get(accountId)?.bookmarks ?? [];
  }
  openBookmark(win, accountId, url) {
    const ws = this.wsFor(win);
    if (!ws) return;
    const tab = this.openTab(ws, accountId, url);
    this.accountState(ws, accountId).activeTabId = tab.id;
    this.afterTabChange(ws, accountId);
  }
  openBookmarkFolder(win, accountId, folderId) {
    const meta = this.accounts.get(accountId);
    if (!meta) return;
    const folder = findFolder(meta.bookmarks, folderId);
    if (!folder) return;
    electron.Menu.buildFromTemplate(this.bookmarkMenu(win, accountId, folder.children)).popup({ window: win });
  }
  /** Popup menu for bookmark-bar items that don't fit (the "More" » button). */
  openBookmarksOverflow(win, accountId, ids) {
    const meta = this.accounts.get(accountId);
    if (!meta) return;
    const nodes = meta.bookmarks.filter((n) => ids.includes(n.id));
    if (nodes.length === 0) return;
    electron.Menu.buildFromTemplate(this.bookmarkMenu(win, accountId, nodes)).popup({ window: win });
  }
  bookmarkMenu(win, accountId, nodes) {
    if (nodes.length === 0) return [{ label: "(empty)", enabled: false }];
    return nodes.map(
      (node) => node.type === "folder" ? { label: node.title || "Folder", submenu: this.bookmarkMenu(win, accountId, node.children) } : { label: node.title || node.url, click: () => this.openBookmark(win, accountId, node.url) }
    );
  }
  getChromeProfiles() {
    try {
      return listChromeProfiles();
    } catch {
      return [];
    }
  }
  importChromeBookmarks(accountId, chromeDir) {
    const meta = this.accounts.get(accountId);
    if (!meta) return;
    try {
      meta.bookmarks = readChromeBookmarkBar(chromeDir);
    } catch {
      return;
    }
    this.broadcastBookmarks(accountId);
    this.onState?.();
  }
  // ---- navigation (per window, acts on active tab) ----------------------
  activeTab(ws) {
    if (!ws.activeAccountId) return void 0;
    const wa = ws.perAccount.get(ws.activeAccountId);
    if (!wa?.activeTabId) return void 0;
    return wa.tabs.find((t) => t.id === wa.activeTabId);
  }
  activeWc(win) {
    const ws = this.wsFor(win);
    return ws ? this.activeTab(ws)?.view?.webContents : void 0;
  }
  goBack(win) {
    const wc = this.activeWc(win);
    if (wc?.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
  }
  goForward(win) {
    const wc = this.activeWc(win);
    if (wc?.navigationHistory.canGoForward()) wc.navigationHistory.goForward();
  }
  reload(win) {
    this.activeWc(win)?.reload();
  }
  navigate(win, input) {
    const target = resolveQuery(input);
    if (target) void this.activeWc(win)?.loadURL(target);
  }
  getActiveNavState(win) {
    const ws = this.wsFor(win);
    if (!ws || !ws.activeAccountId) return null;
    const tab = this.activeTab(ws);
    if (!tab || !tab.view) return null;
    const wc = tab.view.webContents;
    return {
      accountId: ws.activeAccountId,
      tabId: tab.id,
      url: wc.getURL(),
      canGoBack: wc.navigationHistory.canGoBack(),
      canGoForward: wc.navigationHistory.canGoForward(),
      title: wc.getTitle()
    };
  }
  // ---- per-window state queries (for renderer fetch on mount) -----------
  getTabs(win, accountId) {
    const ws = this.wsFor(win);
    if (!ws) return [];
    const wa = ws.perAccount.get(accountId);
    if (!wa) return [];
    return wa.tabs.filter((t) => !t.originShortcutId).map((t) => ({
      id: t.id,
      title: t.title || hostOf(t.currentUrl) || "New tab",
      active: t.id === wa.activeTabId,
      favicon: t.favicon,
      shortcutId: t.originShortcutId
    }));
  }
  getApps(win, accountId) {
    const meta = this.accounts.get(accountId);
    const ws = this.wsFor(win);
    if (!meta || !ws) return { apps: [] };
    const wa = ws.perAccount.get(accountId);
    const activeTab = wa?.tabs.find((t) => t.id === wa.activeTabId);
    const apps = meta.shortcuts.map((s) => ({
      id: s.id,
      label: s.label,
      favicon: s.favicon,
      unread: wa?.unreadByApp[s.id] ?? 0
    }));
    return { apps, activeShortcutId: activeTab?.originShortcutId };
  }
  summaries() {
    return this.order.map((id) => {
      const meta = this.accounts.get(id);
      return { id: meta.id, label: meta.label, color: meta.color, avatarUrl: meta.avatarUrl };
    });
  }
  unreadAll(win) {
    const ws = this.wsFor(win);
    const out = {};
    for (const id of this.order) out[id] = ws ? this.totalUnread(ws, id) : 0;
    return out;
  }
  totalUnread(ws, accountId) {
    const wa = ws.perAccount.get(accountId);
    if (!wa) return 0;
    return Object.values(wa.unreadByApp).reduce((a, b) => a + b, 0);
  }
  // ---- shortcuts (metadata; broadcast) ----------------------------------
  shortcutsFor(id) {
    return this.accounts.get(id)?.shortcuts ?? [];
  }
  addShortcut(id, input) {
    const meta = this.accounts.get(id);
    if (!meta) return;
    meta.shortcuts.push({
      id: crypto.randomUUID(),
      label: input.label.trim() || "Shortcut",
      url: normalizeUrl(input.url) || input.url
    });
    this.broadcastShortcuts(id);
    this.broadcastApps(id);
    this.onState?.();
  }
  updateShortcut(id, shortcutId, patch) {
    const shortcut = this.accounts.get(id)?.shortcuts.find((s) => s.id === shortcutId);
    if (!shortcut) return;
    if (patch.label !== void 0) shortcut.label = patch.label.trim() || shortcut.label;
    if (patch.url !== void 0) shortcut.url = normalizeUrl(patch.url) || shortcut.url;
    this.broadcastShortcuts(id);
    this.broadcastApps(id);
    this.onState?.();
  }
  reorderShortcuts(accountId, shortcutIds) {
    const meta = this.accounts.get(accountId);
    if (!meta) return;
    const byId = new Map(meta.shortcuts.map((s) => [s.id, s]));
    const next = [];
    for (const id of shortcutIds) {
      const shortcut = byId.get(id);
      if (shortcut) next.push(shortcut);
    }
    for (const shortcut of meta.shortcuts) {
      if (!shortcutIds.includes(shortcut.id)) next.push(shortcut);
    }
    if (next.length !== meta.shortcuts.length) return;
    meta.shortcuts = next;
    this.broadcastShortcuts(accountId);
    this.broadcastApps(accountId);
    this.onState?.();
  }
  removeShortcut(id, shortcutId) {
    const meta = this.accounts.get(id);
    if (!meta) return;
    meta.shortcuts = meta.shortcuts.filter((s) => s.id !== shortcutId);
    for (const ws of this.allWindows()) {
      const wa = ws.perAccount.get(id);
      if (wa) delete wa.unreadByApp[shortcutId];
    }
    this.broadcastShortcuts(id);
    this.broadcastApps(id);
    for (const ws of this.allWindows()) this.emitUnread(ws, id);
    this.onState?.();
  }
  // ---- context menus (per window) ---------------------------------------
  popupAccountMenu(win, accountId) {
    if (!this.accounts.has(accountId)) return;
    electron.Menu.buildFromTemplate([
      { label: "Edit", click: () => win.webContents.send("menu:edit-account", accountId) },
      { type: "separator" },
      { label: "Remove", click: () => void this.removeAccount(accountId) }
    ]).popup({ window: win });
  }
  popupShortcutMenu(win, accountId, shortcutId) {
    const ws = this.wsFor(win);
    const openTab = ws?.perAccount.get(accountId)?.tabs.find((t) => t.originShortcutId === shortcutId);
    electron.Menu.buildFromTemplate([
      {
        label: "Edit",
        click: () => win.webContents.send("menu:edit-shortcut", { accountId, shortcutId })
      },
      {
        label: "Close",
        enabled: Boolean(openTab),
        click: () => openTab && this.closeTab(win, accountId, openTab.id)
      },
      { type: "separator" },
      { label: "Remove", click: () => this.removeShortcut(accountId, shortcutId) }
    ]).popup({ window: win });
  }
  // ---- avatar (metadata; broadcast) -------------------------------------
  extractAvatar(accountId, wc) {
    wc.executeJavaScript(AVATAR_SCRIPT, true).then((url) => {
      const meta = this.accounts.get(accountId);
      if (meta && typeof url === "string" && url && url !== meta.avatarUrl) {
        meta.avatarUrl = url;
        this.broadcastUpdated();
        this.onState?.();
      }
    }).catch(() => {
    });
  }
  // ---- persistence ------------------------------------------------------
  partitions() {
    const out = {};
    for (const id of this.order) out[id] = partitionFor(id);
    return out;
  }
  snapshotAccounts() {
    return this.order.map((id, index) => {
      const meta = this.accounts.get(id);
      return {
        id: meta.id,
        label: meta.label,
        color: meta.color,
        homeUrl: meta.homeUrl,
        lastUrl: meta.lastUrl,
        order: index,
        shortcuts: meta.shortcuts,
        avatarUrl: meta.avatarUrl,
        bookmarks: meta.bookmarks
      };
    });
  }
  /** Active account of the first window, persisted as the default for relaunch. */
  defaultActiveId() {
    return this.allWindows()[0]?.activeAccountId ?? this.order[0];
  }
  // ---- layout / visibility (per window) ---------------------------------
  contentLeft() {
    return SIDEBAR_WIDTH + (this.railLayout === "left" ? APP_RAIL_WIDTH : 0);
  }
  topChrome() {
    return TITLE_BAR_HEIGHT + TOP_BAR_HEIGHT + (this.bookmarksBar ? BOOKMARKS_BAR_HEIGHT : 0);
  }
  refreshVisibility(ws) {
    this.materializeActive(ws);
    for (const [accountId, wa] of ws.perAccount) {
      for (const tab of wa.tabs) {
        if (!tab.view) continue;
        const visible = accountId === ws.activeAccountId && tab.id === wa.activeTabId && !ws.overlayOpen;
        tab.view.setVisible(visible);
      }
    }
  }
  layout(ws) {
    if (ws.win.isDestroyed()) return;
    const [width, height] = ws.win.getContentSize();
    const tab = this.activeTab(ws);
    if (!tab || !tab.view) return;
    const left = this.contentLeft();
    const top = this.topChrome();
    const i = CONTENT_INSET;
    tab.view.setBounds({
      x: left + i,
      y: top + i,
      width: Math.max(0, width - left - i * 2),
      height: Math.max(0, height - top - i * 2)
    });
  }
  // ---- emit to a single window's renderer -------------------------------
  emitNav(ws) {
    if (!ws.win.isDestroyed()) ws.win.webContents.send("nav:state", this.getActiveNavState(ws.win));
  }
  emitTabs(ws, accountId) {
    if (!ws.win.isDestroyed()) {
      ws.win.webContents.send("tabs:state", {
        accountId,
        tabs: this.getTabs(ws.win, accountId)
      });
    }
  }
  emitApps(ws, accountId) {
    if (ws.win.isDestroyed()) return;
    const { apps, activeShortcutId } = this.getApps(ws.win, accountId);
    ws.win.webContents.send("apps:state", { accountId, apps, activeShortcutId });
  }
  emitUnread(ws, accountId) {
    if (!ws.win.isDestroyed()) {
      ws.win.webContents.send("accounts:unread", { id: accountId, count: this.totalUnread(ws, accountId) });
    }
  }
  // ---- broadcast metadata changes to every window -----------------------
  broadcastUpdated() {
    const summaries = this.summaries();
    for (const ws of this.allWindows()) {
      if (!ws.win.isDestroyed()) ws.win.webContents.send("accounts:updated", summaries);
    }
  }
  broadcastShortcuts(accountId) {
    const shortcuts = this.shortcutsFor(accountId);
    for (const ws of this.allWindows()) {
      if (!ws.win.isDestroyed()) {
        ws.win.webContents.send("shortcuts:updated", { accountId, shortcuts });
      }
    }
  }
  broadcastApps(accountId) {
    for (const ws of this.allWindows()) this.emitApps(ws, accountId);
  }
  broadcastBookmarks(accountId) {
    const meta = this.accounts.get(accountId);
    if (!meta) return;
    for (const ws of this.allWindows()) {
      if (!ws.win.isDestroyed()) {
        ws.win.webContents.send("bookmarks:state", { accountId, bookmarks: meta.bookmarks });
      }
    }
  }
}
function registerIpc(accounts2, onNewWindow) {
  const winOf = (event) => electron.BrowserWindow.fromWebContents(event.sender);
  electron.ipcMain.handle("window:new", () => onNewWindow());
  electron.ipcMain.handle("accounts:active", (e) => {
    const win = winOf(e);
    return win ? accounts2.getActiveId(win) : void 0;
  });
  electron.ipcMain.handle("accounts:switch", (e, id) => {
    const win = winOf(e);
    if (win) accounts2.setActive(win, id);
  });
  electron.ipcMain.handle("accounts:unread-all", (e) => {
    const win = winOf(e);
    return win ? accounts2.unreadAll(win) : {};
  });
  electron.ipcMain.handle("nav:back", (e) => {
    const win = winOf(e);
    if (win) accounts2.goBack(win);
  });
  electron.ipcMain.handle("nav:forward", (e) => {
    const win = winOf(e);
    if (win) accounts2.goForward(win);
  });
  electron.ipcMain.handle("nav:reload", (e) => {
    const win = winOf(e);
    if (win) accounts2.reload(win);
  });
  electron.ipcMain.handle("nav:go", (e, url) => {
    const win = winOf(e);
    if (win) accounts2.navigate(win, url);
  });
  electron.ipcMain.handle("nav:state", (e) => {
    const win = winOf(e);
    return win ? accounts2.getActiveNavState(win) : null;
  });
  electron.ipcMain.handle("apps:list", (e, accountId) => {
    const win = winOf(e);
    return win ? accounts2.getApps(win, accountId) : { apps: [] };
  });
  electron.ipcMain.handle("tabs:list", (e, accountId) => {
    const win = winOf(e);
    return win ? accounts2.getTabs(win, accountId) : [];
  });
  electron.ipcMain.handle("tabs:open-shortcut", (e, accountId, shortcutId) => {
    const win = winOf(e);
    if (win) accounts2.openShortcut(win, accountId, shortcutId);
  });
  electron.ipcMain.handle("tabs:new", (e, accountId) => {
    const win = winOf(e);
    if (win) accounts2.newTab(win, accountId);
  });
  electron.ipcMain.handle("tabs:activate", (e, accountId, tabId) => {
    const win = winOf(e);
    if (win) accounts2.activateTab(win, accountId, tabId);
  });
  electron.ipcMain.handle("tabs:close", (e, accountId, tabId) => {
    const win = winOf(e);
    if (win) accounts2.closeTab(win, accountId, tabId);
  });
  electron.ipcMain.handle("tabs:reorder", (e, accountId, tabIds) => {
    const win = winOf(e);
    if (win) accounts2.reorderTabs(win, accountId, tabIds);
  });
  electron.ipcMain.handle("bookmarks:open", (e, accountId, url) => {
    const win = winOf(e);
    if (win) accounts2.openBookmark(win, accountId, url);
  });
  electron.ipcMain.handle("bookmarks:open-folder", (e, accountId, folderId) => {
    const win = winOf(e);
    if (win) accounts2.openBookmarkFolder(win, accountId, folderId);
  });
  electron.ipcMain.handle("bookmarks:open-overflow", (e, accountId, ids) => {
    const win = winOf(e);
    if (win) accounts2.openBookmarksOverflow(win, accountId, ids);
  });
  electron.ipcMain.handle("menu:account", (e, accountId) => {
    const win = winOf(e);
    if (win) accounts2.popupAccountMenu(win, accountId);
  });
  electron.ipcMain.handle("menu:shortcut", (e, accountId, shortcutId) => {
    const win = winOf(e);
    if (win) accounts2.popupShortcutMenu(win, accountId, shortcutId);
  });
  electron.ipcMain.handle("chrome:overlay", (e, open) => {
    const win = winOf(e);
    if (win) accounts2.setOverlayOpen(win, open);
  });
  electron.ipcMain.handle("accounts:list", () => accounts2.summaries());
  electron.ipcMain.handle("accounts:add", (_e, input) => {
    accounts2.addAccount(input);
  });
  electron.ipcMain.handle(
    "accounts:update",
    (_e, id, patch) => accounts2.updateAccount(id, patch)
  );
  electron.ipcMain.handle("accounts:remove", (_e, id) => accounts2.removeAccount(id));
  electron.ipcMain.handle("shortcuts:list", (_e, accountId) => accounts2.shortcutsFor(accountId));
  electron.ipcMain.handle(
    "shortcuts:add",
    (_e, accountId, input) => accounts2.addShortcut(accountId, input)
  );
  electron.ipcMain.handle(
    "shortcuts:update",
    (_e, accountId, shortcutId, patch) => accounts2.updateShortcut(accountId, shortcutId, patch)
  );
  electron.ipcMain.handle(
    "shortcuts:remove",
    (_e, accountId, shortcutId) => accounts2.removeShortcut(accountId, shortcutId)
  );
  electron.ipcMain.handle(
    "apps:reorder",
    (_e, accountId, shortcutIds) => accounts2.reorderShortcuts(accountId, shortcutIds)
  );
  electron.ipcMain.handle("layout:get", () => accounts2.getLayout());
  electron.ipcMain.handle("bookmarks:list", (_e, accountId) => accounts2.getBookmarks(accountId));
  electron.ipcMain.handle("bookmarks:bar-visible", () => accounts2.getBookmarksBarVisible());
  electron.ipcMain.handle("bookmarks:chrome-profiles", () => accounts2.getChromeProfiles());
  electron.ipcMain.handle(
    "bookmarks:import",
    (_e, accountId, chromeDir) => accounts2.importChromeBookmarks(accountId, chromeDir)
  );
  electron.ipcMain.handle("__test:partitions", () => accounts2.partitions());
  electron.ipcMain.handle(
    "__test:set-cookie",
    (_e, arg) => electron.session.fromPartition(arg.partition).cookies.set({
      url: arg.url,
      name: arg.name,
      value: arg.value
    })
  );
  electron.ipcMain.handle("__test:get-cookies", async (_e, arg) => {
    const cookies = await electron.session.fromPartition(arg.partition).cookies.get({ url: arg.url });
    return cookies.map((c) => ({ name: c.name, value: c.value }));
  });
}
function buildAppMenu(handlers) {
  const accountItems = Array.from({ length: 9 }, (_, i) => ({
    label: `Switch to Account ${i + 1}`,
    accelerator: `CommandOrControl+${i + 1}`,
    click: () => handlers.switchToIndex(i)
  }));
  const template = [
    ...process.platform === "darwin" ? [{ role: "appMenu" }] : [],
    {
      label: "File",
      submenu: [
        {
          label: "New Window",
          accelerator: "CommandOrControl+N",
          click: () => handlers.newWindow()
        }
      ]
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { label: "Zoom In", accelerator: "CommandOrControl+=", click: handlers.zoomIn },
        { label: "Zoom Out", accelerator: "CommandOrControl+-", click: handlers.zoomOut },
        { label: "Actual Size", accelerator: "CommandOrControl+0", click: handlers.zoomReset },
        { type: "separator" },
        {
          label: "App Layout",
          submenu: [
            {
              label: "Left Rail",
              type: "radio",
              checked: handlers.layout === "left",
              click: () => handlers.setLayout("left")
            },
            {
              label: "Top Right",
              type: "radio",
              checked: handlers.layout === "top",
              click: () => handlers.setLayout("top")
            }
          ]
        }
      ]
    },
    {
      label: "Bookmarks",
      submenu: [
        {
          label: "Show Bookmarks Bar",
          type: "checkbox",
          checked: handlers.bookmarksBar,
          accelerator: "CommandOrControl+Shift+B",
          click: () => handlers.toggleBookmarksBar()
        },
        { type: "separator" },
        { label: "Import from Chrome…", click: () => handlers.importBookmarks() }
      ]
    },
    { label: "Accounts", submenu: accountItems },
    { role: "windowMenu" }
  ];
  electron.Menu.setApplicationMenu(electron.Menu.buildFromTemplate(template));
}
const SHARED_DIR = process.env.GLIDE_SHARED_DIR || "/Users/Shared/Glide";
const DEFAULT_ACCOUNTS = [
  { id: "one", label: "One", color: "#4c8bf5", homeUrl: "https://mail.google.com", order: 0 },
  { id: "two", label: "Two", color: "#34a853", homeUrl: "https://mail.google.com", order: 1 },
  { id: "three", label: "Three", color: "#ea4335", homeUrl: "https://mail.google.com", order: 2 }
];
function defaultState() {
  return { version: 1, accounts: DEFAULT_ACCOUNTS.map((a) => ({ ...a })) };
}
function statePath() {
  return path.join(SHARED_DIR, "glide-state.json");
}
function legacyStatePath() {
  return path.join(electron.app.getPath("userData"), "glide-state.json");
}
function ensureSharedDir() {
  try {
    if (!fs.existsSync(SHARED_DIR)) {
      fs.mkdirSync(SHARED_DIR, { recursive: true });
      fs.chmodSync(SHARED_DIR, 511);
    }
  } catch {
  }
}
function loadState() {
  ensureSharedDir();
  try {
    if (!fs.existsSync(statePath()) && fs.existsSync(legacyStatePath())) {
      fs.writeFileSync(statePath(), fs.readFileSync(legacyStatePath(), "utf8"), "utf8");
      try {
        fs.chmodSync(statePath(), 438);
      } catch {
      }
    }
  } catch {
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath(), "utf8"));
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.accounts) || parsed.accounts.length === 0) {
      return defaultState();
    }
    return parsed;
  } catch {
    return defaultState();
  }
}
function saveState(state2) {
  try {
    ensureSharedDir();
    fs.writeFileSync(statePath(), JSON.stringify(state2, null, 2), "utf8");
    try {
      fs.chmodSync(statePath(), 438);
    } catch {
    }
  } catch {
  }
}
electron.app.setName("Glide");
if (process.env.GLIDE_USER_DATA_DIR) {
  electron.app.setPath("userData", process.env.GLIDE_USER_DATA_DIR);
}
let accounts;
let state = { version: 1, accounts: [] };
let persistTimer;
function buildState() {
  const focused = electron.BrowserWindow.getFocusedWindow() ?? electron.BrowserWindow.getAllWindows()[0];
  const bounds = focused && !focused.isDestroyed() ? focused.getBounds() : void 0;
  return {
    version: 1,
    accounts: accounts ? accounts.snapshotAccounts() : state.accounts,
    activeAccountId: accounts?.defaultActiveId() ?? state.activeAccountId,
    window: bounds ? { width: bounds.width, height: bounds.height, x: bounds.x, y: bounds.y } : state.window,
    zoomFactor: accounts?.getZoom() ?? state.zoomFactor,
    layout: accounts?.getLayout() ?? state.layout,
    bookmarksBar: accounts?.getBookmarksBarVisible() ?? state.bookmarksBar,
    seededPasswordsApp: state.seededPasswordsApp
  };
}
function seedPasswordsApp() {
  if (state.seededPasswordsApp) return;
  for (const account of state.accounts) {
    if (account.shortcuts && !account.shortcuts.some((s) => s.url.includes("passwords.google.com"))) {
      account.shortcuts.push({
        id: crypto.randomUUID(),
        label: "Passwords",
        url: "https://passwords.google.com"
      });
    }
  }
  state.seededPasswordsApp = true;
  saveState(state);
}
function installMenu() {
  buildAppMenu({
    newWindow: () => createWindow(),
    switchToIndex: (index) => {
      const win = electron.BrowserWindow.getFocusedWindow();
      if (win) accounts?.setActiveByIndex(win, index);
    },
    zoomIn: () => accounts?.zoomIn(),
    zoomOut: () => accounts?.zoomOut(),
    zoomReset: () => accounts?.zoomReset(),
    layout: accounts?.getLayout() ?? "left",
    setLayout: (layout) => {
      accounts?.setLayout(layout);
      installMenu();
    },
    bookmarksBar: accounts?.getBookmarksBarVisible() ?? false,
    toggleBookmarksBar: () => {
      accounts?.setBookmarksBarVisible(!accounts.getBookmarksBarVisible());
      installMenu();
    },
    importBookmarks: () => electron.BrowserWindow.getFocusedWindow()?.webContents.send("menu:import-bookmarks")
  });
}
function persistNow() {
  state = buildState();
  saveState(state);
}
function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(persistNow, 400);
}
function createWindow() {
  const isFirst = electron.BrowserWindow.getAllWindows().length === 0;
  const win = new electron.BrowserWindow({
    width: state.window?.width ?? 1280,
    height: state.window?.height ?? 800,
    // Only the first window restores the saved position; extra windows cascade.
    x: isFirst ? state.window?.x : void 0,
    y: isFirst ? state.window?.y : void 0,
    title: "Glide",
    show: false,
    backgroundColor: "#202124",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 14, y: 8 },
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  win.on("ready-to-show", () => win.show());
  win.on("resize", schedulePersist);
  win.on("move", schedulePersist);
  if (process.env["ELECTRON_RENDERER_URL"]) {
    void win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    void win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  win.webContents.once("did-finish-load", () => {
    accounts?.registerWindow(win, state.activeAccountId);
  });
}
const gotInstanceLock = electron.app.requestSingleInstanceLock();
if (!gotInstanceLock) {
  electron.app.quit();
}
electron.app.on("second-instance", () => {
  if (accounts) createWindow();
});
electron.app.on("web-contents-created", (_event, contents) => {
  contents.on("will-navigate", (e, url) => {
    if (isExternalProtocol(url)) {
      e.preventDefault();
      void electron.shell.openExternal(url).catch(() => {
      });
    }
  });
});
electron.app.whenReady().then(() => {
  if (!gotInstanceLock) return;
  state = loadState();
  seedPasswordsApp();
  accounts = new AccountManager(schedulePersist);
  registerIpc(accounts, createWindow);
  const configs = [...state.accounts].sort((a, b) => a.order - b.order).map((a) => ({
    id: a.id,
    label: a.label,
    color: a.color,
    homeUrl: a.homeUrl,
    lastUrl: a.lastUrl,
    shortcuts: a.shortcuts,
    avatarUrl: a.avatarUrl,
    bookmarks: a.bookmarks
  }));
  accounts.loadMetadata(configs);
  if (state.zoomFactor) accounts.setZoom(state.zoomFactor);
  if (state.layout) accounts.setLayout(state.layout);
  if (state.bookmarksBar) accounts.setBookmarksBarVisible(true);
  installMenu();
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("before-quit", persistNow);
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});

# Glide — Progress

Loop-maintained status of the phased build (see REQUIREMENTS.md §5).
Legend: ✅ done & verified · 🔧 in progress · ⬜ not started

| Phase | Title | Status |
|---|---|---|
| 0 | Scaffold & boot | ✅ |
| 1 | One isolated account view | ✅ |
| 2 | Multiple accounts + sidebar switching + isolation proof | ✅ |
| 3 | Persistence | ✅ |
| 4 | Account management UI (add/remove/edit) | ✅ |
| 5 | Browser chrome (navigation) | ⬜ |
| 6 | Visual identity + unread badges | ⬜ |
| 7 | Notifications + keyboard shortcuts | ⬜ |
| 8+ | Optional polish | ⬜ (only if requested) |

## Next up
**Phase 5 — Browser chrome (navigation).** Slim top bar above the active account
view: back, forward, reload, editable address field. Buttons/field act on the
active account's `webContents` (goBack/goForward/reload/loadURL, prefix https://
if missing). Address shows the live URL and updates on navigation; back/forward
enabled state reflects history. Switching accounts swaps the bar to the new
view's URL. Popups stay in the same partition (`setWindowOpenHandler`, §4.6).
Note: the account view bounds must drop below the top bar height (currently y:0,
full height) — reserve a top strip in `AccountManager.layout()`.

## Pending manual checks (need a real Google login)
- **Phase 1:** Run `npm start`, log into Gmail in the account pane, quit, relaunch
  → should still be logged in (confirms the `persist:` partition survives restart).
  Also confirm the pane resizes with the window.
- **Phase 2:** With the 3 seed accounts, click each sidebar avatar → the visible
  Google session switches instantly and the active avatar is highlighted.
  Switching back is instant (background views stay loaded, no reload). Logging
  into one account does not affect the others (the automated isolation test
  already proves the cookie-level guarantee).
- **Phase 3:** Navigate each account somewhere specific (e.g. Calendar, Drive),
  resize/move the window, quit, relaunch → same accounts on the same pages, same
  active account, same window geometry. Then quit, delete
  `~/Library/Application Support/Glide/glide-state.json`, relaunch → clean start
  with the 3 default accounts (no crash).
- **Phase 4:** Click `[+]`, add an account (label/color/URL) → it appears, becomes
  active, and works; survives restart. Right-click → Edit changes label/color
  (reflected immediately + after restart). Right-click → Remove deletes it from
  the sidebar and disk; re-adding the same account requires a fresh Google login
  (session was wiped). Confirm it all works with ≥4 accounts at once.

## Phase log
- **Phase 4 — ✅** Account set is now editable from the UI. Sidebar `[+]` opens an
  Add dialog (label, color, home URL); right-click an avatar → Edit (label/color)
  or Remove. Main gained `addAccount` (uuid + new partition + view, made active),
  `updateAccount`, and `removeAccount` (destroys the view AND calls
  `clearStorageData()` on its partition so the account is truly gone), plus an
  `accounts:updated` push so the sidebar re-renders. New IPC + preload methods +
  shared types. guard + build + smoke + isolation pass. Add/edit/remove behavior
  is a manual check (GUI). (Note: respected the §2.2 non-goal of "no tests beyond
  §6" — no new test file added.)
- **Phase 3 — ✅** Added `src/main/persistence.ts` (load/save `PersistedState`
  JSON in userData, defaults on missing/corrupt). `AccountManager` now tracks each
  account's current URL (did-navigate / in-page) and exposes `snapshotAccounts()`.
  Main restores window bounds + accounts + active + per-account `lastUrl` on launch
  and saves debounced on navigation/active-change/resize/move, plus on before-quit.
  Set `app.setName('Glide')` so data lives in `Application Support/Glide/`. Verified
  the state file is written with accounts, lastUrl, activeAccountId, and window
  geometry. guard + build + smoke + isolation pass. Restart-restore is a manual
  check (needs a GUI session).
- **Phase 2 — ✅** Multiple isolated accounts (3 hardcoded seeds), each its own
  `persist:account-<id>` WebContentsView. Sidebar renders avatars; clicking
  switches the active view via IPC (`accounts:switch` / `accounts:active-changed`),
  active item highlighted. Added shared types, typed `window.glide` bridge, and
  `tests/isolation.spec.ts` (+ `test:isolation`) proving cookies don't bleed
  across partitions. guard + build + smoke + isolation all pass. (Fix during the
  phase: the isolation test had named its Playwright Page `window`, shadowing the
  browser global inside `evaluate`; renamed to `page`.)
- **Phase 1 — ✅** Added `AccountManager` (src/main/accounts.ts) owning a
  `WebContentsView` on partition `persist:account-default`, loading Gmail,
  positioned right of the 64px sidebar and re-laid-out on window resize. Account
  views use no preload, no node integration, context isolation on. guard + build
  + test:smoke pass. Manual login-persistence check pending (see above).
- **Phase 0 — ✅** Scaffolded electron-vite + React + TypeScript. Window opens at
  1280×800 titled "Glide" with the sidebar shell. `npm run guard`, `npm run build`,
  and `npm run test:smoke` all pass. Security defaults set (contextIsolation on,
  nodeIntegration off, preload via contextBridge).

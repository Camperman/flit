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
| 5 | Browser chrome (navigation) | ✅ |
| 6 | Visual identity + unread badges | ⬜ |
| 7 | Notifications + keyboard shortcuts | ⬜ |
| 8+ | Optional polish | ⬜ (only if requested) |

## Next up
**Phase 6 — Visual identity + unread badges.** Sidebar avatar = account color bg
+ first letter (already present); make active state clear (present). Add unread
badges: parse the active/background view's page title for a leading `(\d+)`
(Gmail's `Inbox (12) …`) and show a numeric badge on the sidebar item; update
live; clear at zero. Title parsing must run for ALL accounts (background too),
so AccountManager should watch every view's `page-title-updated`, extract the
count, and push per-account unread counts to the renderer (e.g. `accounts:unread`
{ id, count }). Sidebar renders the badge.

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
- **Phase 5:** In one account, type `calendar.google.com` in the address bar →
  navigates there, still logged into that same account; repeat for Drive/Docs.
  Back/forward/reload work and enable/disable correctly. Switch accounts → the
  address bar swaps to the other account's current URL. A Google popup (e.g.
  compose-in-new-window or an OAuth prompt) opens logged into the same account.

## Phase log
- **Phase 5 — ✅** Added browser chrome: a 44px top bar (`TopBar.tsx`) with
  back/forward/reload + an editable address field, all acting on the active
  account's webContents via IPC (`nav:back/forward/reload/go/state`). Main pushes
  `nav:state` (url, canGoBack/Forward, title) on navigation, title change, and
  active switch; uses the modern `webContents.navigationHistory` API. Account view
  bounds now reserve the top strip (`TOP_BAR_HEIGHT`, kept in sync with the
  `.topbar` CSS). `navigate()` prefixes `https://` via `normalizeUrl`. Popups stay
  in-partition via `setWindowOpenHandler` with an overridden partition. guard +
  build + smoke + isolation pass. In-pane navigation is a manual check (GUI).
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

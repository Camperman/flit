# Glide — Progress

Loop-maintained status of the phased build (see REQUIREMENTS.md §5).
Legend: ✅ done & verified · 🔧 in progress · ⬜ not started

| Phase | Title | Status |
|---|---|---|
| 0 | Scaffold & boot | ✅ |
| 1 | One isolated account view | ✅ |
| 2 | Multiple accounts + sidebar switching + isolation proof | ✅ |
| 3 | Persistence | ⬜ |
| 4 | Account management UI (add/remove/edit) | ⬜ |
| 5 | Browser chrome (navigation) | ⬜ |
| 6 | Visual identity + unread badges | ⬜ |
| 7 | Notifications + keyboard shortcuts | ⬜ |
| 8+ | Optional polish | ⬜ (only if requested) |

## Next up
**Phase 3 — Persistence.** Read/write a `PersistedState` JSON in `userData`
(accounts, activeAccountId, window bounds). On launch, restore accounts +
active + per-account `lastUrl` + window geometry. Persist `lastUrl` per account
on navigation (debounced) and window bounds on resize/move. Missing/corrupt
file → clean launch with defaults.

## Pending manual checks (need a real Google login)
- **Phase 1:** Run `npm start`, log into Gmail in the account pane, quit, relaunch
  → should still be logged in (confirms the `persist:` partition survives restart).
  Also confirm the pane resizes with the window.
- **Phase 2:** With the 3 seed accounts, click each sidebar avatar → the visible
  Google session switches instantly and the active avatar is highlighted.
  Switching back is instant (background views stay loaded, no reload). Logging
  into one account does not affect the others (the automated isolation test
  already proves the cookie-level guarantee).

## Phase log
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

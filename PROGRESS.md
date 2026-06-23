# Glide — Progress

Loop-maintained status of the phased build (see REQUIREMENTS.md §5).
Legend: ✅ done & verified · 🔧 in progress · ⬜ not started

| Phase | Title | Status |
|---|---|---|
| 0 | Scaffold & boot | ✅ |
| 1 | One isolated account view | ✅ |
| 2 | Multiple accounts + sidebar switching + isolation proof | ⬜ |
| 3 | Persistence | ⬜ |
| 4 | Account management UI (add/remove/edit) | ⬜ |
| 5 | Browser chrome (navigation) | ⬜ |
| 6 | Visual identity + unread badges | ⬜ |
| 7 | Notifications + keyboard shortcuts | ⬜ |
| 8+ | Optional polish | ⬜ (only if requested) |

## Next up
**Phase 2 — Multiple accounts + sidebar switching + isolation proof.** Manage
2–3 hardcoded accounts, each its own `persist:account-<id>` WebContentsView.
Render them in the sidebar; clicking switches the active view (IPC
switchAccount/activeChanged). Add `tests/isolation.spec.ts` + `test:isolation`
script proving cookies don't bleed between partitions — this MUST pass.

## Pending manual checks (need a real Google login)
- **Phase 1:** Run `npm start`, log into Gmail in the account pane, quit, relaunch
  → should still be logged in (confirms the `persist:` partition survives restart).
  Also confirm the pane resizes with the window.

## Phase log
- **Phase 1 — ✅** Added `AccountManager` (src/main/accounts.ts) owning a
  `WebContentsView` on partition `persist:account-default`, loading Gmail,
  positioned right of the 64px sidebar and re-laid-out on window resize. Account
  views use no preload, no node integration, context isolation on. guard + build
  + test:smoke pass. Manual login-persistence check pending (see above).
- **Phase 0 — ✅** Scaffolded electron-vite + React + TypeScript. Window opens at
  1280×800 titled "Glide" with the sidebar shell. `npm run guard`, `npm run build`,
  and `npm run test:smoke` all pass. Security defaults set (contextIsolation on,
  nodeIntegration off, preload via contextBridge).

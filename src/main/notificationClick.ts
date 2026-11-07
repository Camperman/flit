// Notification-click → main window routing (Phase 42).
//
// When a web notification is clicked, the page's own click handler often asks
// for a new window. Gmail's does, verbatim (captured live 2026-11-06):
//   window.open("/mail/u/0/popout?ver=…&search=inbox&type=FMfcgz…&th=…",
//               "xj0n74zcoldw", "width=800,location=0,height=660,…")
// Because it carries size features Electron reports it as a real popup, and
// Flit gave it a bare window. A notification click should land in the main
// Flit window instead, so for a short moment after a click the tab's
// window.open is rerouted (see accounts.ts setWindowOpenHandler).
//
// No electron import here so the Playwright spec can unit-test it directly.

/** How long after a notification click a window.open counts as caused by it.
 *  The page's handler runs synchronously right after Flit's own listener
 *  (measured: 1 ms apart), so this only needs to absorb IPC jitter. */
export const NOTIFICATION_OPEN_WINDOW_MS = 1500

/**
 * Map a Gmail popout URL to the same thread in the tab's normal view, or null
 * if `url` isn't one.
 *
 * The thread is `th=#thread-f:<decimal id>`. NOT `type`/`search`: those
 * describe whatever the tab was showing when the notification fired (in the
 * capture above, `type` was the token of a different, already-open email).
 * Gmail opens `#inbox/<hex thread id>` and rewrites it to its own token —
 * verified live 2026-11-06: thread-f:1881158970757441198 → #inbox/1a1b381dfa0966ae
 * opened the notified message.
 */
export function gmailPopoutToThreadUrl(url: string): string | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (u.hostname !== 'mail.google.com') return null
  const m = /^\/mail\/u\/(\d+)\/popout$/.exec(u.pathname)
  if (!m) return null
  const th = /^#?thread-f:(\d+)$/.exec(u.searchParams.get('th') ?? '')
  if (!th) return null
  return `https://mail.google.com/mail/u/${m[1]}/#inbox/${BigInt(th[1]).toString(16)}`
}

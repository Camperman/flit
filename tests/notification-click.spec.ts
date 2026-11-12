import { test, expect } from '@playwright/test'
import { launchFlit } from './launch'
import { gmailPopoutToThreadUrl } from '../src/main/notificationClick'

// Phase 42: clicking a web notification must land in the main Flit window.
// Gmail's notification click handler calls window.open() with size features
// for a "popout" of the message (captured live 2026-11-06):
//   window.open("/mail/u/0/popout?ver=…&search=inbox&type=FMfcgz…&th=…",
//               "xj0n74zcoldw", "width=800,location=0,height=660,…")
// Flit used to honour that as a bare popup window.

test('Gmail popout URL maps to the notified thread, not the open one', () => {
  // The real captured URL. `type` is the token of the email the tab was
  // already showing; `th` is the thread the notification was about. Opening
  // #inbox/1a1b381dfa0966ae in Gmail showed the notified message (verified live).
  expect(
    gmailPopoutToThreadUrl(
      'https://mail.google.com/mail/u/0/popout?ver=rfyiba8hf818&search=inbox' +
        '&type=FMfcgzQjgqKNgrDcHDQsJRHqlTjqHRhL&th=%23thread-f%3A1881158970757441198&cvid=1'
    )
  ).toBe('https://mail.google.com/mail/u/0/#inbox/1a1b381dfa0966ae')
  // Another signed-in slot keeps its /u/N.
  expect(
    gmailPopoutToThreadUrl('https://mail.google.com/mail/u/2/popout?search=inbox&th=%23thread-f%3A255')
  ).toBe('https://mail.google.com/mail/u/2/#inbox/ff')
  // Not a Gmail popout, or no thread id → null (caller opens it as a tab).
  expect(gmailPopoutToThreadUrl('https://mail.google.com/mail/u/0/#inbox')).toBeNull()
  expect(gmailPopoutToThreadUrl('https://example.com/mail/u/0/popout?th=%23thread-f%3A1')).toBeNull()
  expect(gmailPopoutToThreadUrl('https://mail.google.com/mail/u/0/popout?search=inbox&type=X')).toBeNull()
})

/** Load `url` in the first account view and wait for Flit's notification hook. */
async function loadAccountPage(app: Awaited<ReturnType<typeof launchFlit>>, url: string): Promise<number> {
  return app.evaluate(async ({ webContents, session }, url) => {
    // Account views live on their own partitions; Flit's UI uses the default.
    const target = webContents.getAllWebContents().find((w) => w.session !== session.defaultSession)
    if (!target) throw new Error('no account webContents')
    await target.loadURL(url)
    // The hook is injected on did-finish-load; give it a beat.
    for (let i = 0; i < 50; i++) {
      if (await target.executeJavaScript('!!window.__flitNotifHook')) break
      await new Promise((r) => setTimeout(r, 100))
    }
    return target.id
  }, url)
}

/** In the page: optionally click a notification, then do a sized window.open. */
async function openPopup(
  app: Awaited<ReturnType<typeof launchFlit>>,
  wcId: number,
  viaNotification: boolean,
  url: string
): Promise<void> {
  await app.evaluate(
    async ({ webContents }, { wcId, viaNotification, url }) => {
      const wc = webContents.fromId(wcId)!
      await wc.executeJavaScript(
        `(() => {
          const open = () => window.open(${JSON.stringify(url)}, 'pop', 'width=800,height=660')
          if (!${viaNotification}) { open(); return }
          const n = new Notification('Flit test', { silent: true })
          n.addEventListener('click', open)
          n.dispatchEvent(new Event('click'))
          n.close()
        })()`,
        true
      )
    },
    { wcId, viaNotification, url }
  )
}

const windowCount = (app: Awaited<ReturnType<typeof launchFlit>>): Promise<number> =>
  app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)

const urlsOpen = (app: Awaited<ReturnType<typeof launchFlit>>): Promise<string[]> =>
  app.evaluate(({ webContents }) => webContents.getAllWebContents().map((w) => w.getURL()))

test('a window.open right after a notification click opens a tab, not a window', async () => {
  const app = await launchFlit()
  const page = await app.firstWindow()
  await page.locator('[data-testid="sidebar"]').waitFor()

  const wcId = await loadAccountPage(app, 'https://example.com/')
  const before = await windowCount(app)

  // Relative, like Gmail's — the handler must receive it resolved.
  await openPopup(app, wcId, true, '/from-notification')
  await expect.poll(() => urlsOpen(app)).toContain('https://example.com/from-notification')
  expect(await windowCount(app)).toBe(before)

  await app.close()
})

test('a second launch focuses the existing window instead of opening another', async () => {
  // Clicking a notification makes macOS launch whichever copy of Flit it
  // resolves the bundle id to. If that's a different copy (an old backup, the
  // DMG), the new process hits the single-instance lock and quits, and Flit
  // gets `second-instance`. Seen live 2026-11-12: usernoted launched
  // /Applications/.Flit-prev.app and the user got a whole new Flit window.
  const app = await launchFlit()
  const page = await app.firstWindow()
  await page.locator('[data-testid="sidebar"]').waitFor()
  const before = await windowCount(app)

  await app.evaluate(({ app }) => {
    app.emit('second-instance', {}, [], '/', {})
  })
  // Give a would-be window time to be created.
  await new Promise((r) => setTimeout(r, 1000))
  expect(await windowCount(app)).toBe(before)

  await app.close()
})

test('a sized window.open without a notification click still gets its own window', async () => {
  // Control: OAuth / sign-in popups rely on this.
  const app = await launchFlit()
  const page = await app.firstWindow()
  await page.locator('[data-testid="sidebar"]').waitFor()

  const wcId = await loadAccountPage(app, 'https://example.com/')
  const before = await windowCount(app)

  await openPopup(app, wcId, false, 'https://example.org/plain-popup')
  await expect.poll(() => windowCount(app)).toBe(before + 1)

  await app.close()
})

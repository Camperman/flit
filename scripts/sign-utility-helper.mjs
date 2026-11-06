// electron-builder afterSign hook.
//
// Gives ONLY "<App> Helper.app" — the bundle Chromium launches utility
// processes from — the disable-library-validation entitlement, then re-seals
// the outer bundle.
//
// Why it is needed: the Widevine CDM is a dylib downloaded at runtime by
// Chrome's component updater (castLabs' Electron does not bundle it). Under the
// hardened runtime, library validation refuses to load a dylib signed by
// another team, so createMediaKeys() fails with "CreateCdmFunc not available"
// — while requestMediaKeySystemAccess() still succeeds, because that only
// checks the CDM is registered, not that it loads. Measured 2026-11-06:
// unsigned build loads the CDM, signed build does not.
//
// Why THIS helper: Electron runs the CDM as a utility process, and utility
// processes launch from the generic "<App> Helper.app" — confirmed from the
// running process list (network.mojom.NetworkService and audio.mojom.
// AudioService both run from it). Google Chrome entitles its Helper (Plugin)
// instead, but that bundle is legacy PPAPI and entitling it here changed
// nothing.
//
// Why not everywhere: disable-library-validation lets a process load arbitrary
// unsigned libraries. Scoping it here keeps it OFF the two most
// attack-exposed processes — Helper (Renderer).app and Helper (GPU).app have
// their own bundles and stay fully hardened. Using electron-builder's
// entitlementsInherit would have covered those too, which is why this is a hook
// (electron-builder can only pick entitlements per root app / login helper /
// everything else).
//
// Re-signing a nested helper invalidates the outer signature, because a bundle
// seals its contents, so the outer app is signed again afterwards. The outer
// pass is deliberately NOT --deep: that would re-sign the helpers and undo this.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const sh = (args) => execFileSync(args[0], args.slice(1), { encoding: 'utf8' })

/** The Developer ID the app was just signed with, so both passes match. */
function resolveIdentity(appPath) {
  let team
  try {
    team = /TeamIdentifier=([A-Z0-9]+)/.exec(sh(['codesign', '-dvv', appPath]))?.[1]
  } catch {
    // codesign writes this to stderr; fall through to the keychain lookup.
  }
  const lines = sh(['security', 'find-identity', '-v', '-p', 'codesigning'])
    .split('\n')
    .filter((l) => l.includes('Developer ID Application'))
  const match = team ? lines.find((l) => l.includes(`(${team})`)) : undefined
  const hash = /\b([0-9A-F]{40})\b/.exec(match ?? lines[0] ?? '')?.[1]
  if (!hash) throw new Error('sign-utility-helper: no Developer ID Application identity found')
  return hash
}

export default async function signUtilityHelper(context) {
  if (context.electronPlatformName !== 'darwin') return

  const name = context.packager.appInfo.productFilename
  const appPath = join(context.appOutDir, `${name}.app`)
  const helper = join(appPath, 'Contents', 'Frameworks', `${name} Helper.app`)

  if (!existsSync(helper)) {
    console.log(`sign-utility-helper: ${name} Helper.app not found — skipping`)
    return
  }

  // Unsigned build (npm run package sets identity=null): nothing to re-sign.
  try {
    sh(['codesign', '-dv', appPath])
  } catch {
    console.log('sign-utility-helper: app is not signed — skipping')
    return
  }

  const identity = resolveIdentity(appPath)
  const utilityEntitlements = join(process.cwd(), 'build', 'entitlements.mac.utility.plist')
  const appEntitlements = join(process.cwd(), 'build', 'entitlements.mac.plist')

  console.log('sign-utility-helper: re-signing the utility helper (Widevine CDM host)')
  sh([
    'codesign', '--force', '--timestamp', '--options', 'runtime',
    '--entitlements', utilityEntitlements, '--sign', identity, helper
  ])

  console.log('sign-utility-helper: re-sealing the outer bundle (not --deep)')
  sh([
    'codesign', '--force', '--timestamp', '--options', 'runtime',
    '--entitlements', appEntitlements, '--sign', identity, appPath
  ])

  sh(['codesign', '--verify', '--strict', appPath])
  console.log('sign-utility-helper: done, signature verifies')
}

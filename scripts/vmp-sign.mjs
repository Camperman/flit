// electron-builder afterPack hook — Widevine VMP signing via castLabs EVS.
//
// WHY THIS IS afterPack AND NOT afterSign: castLabs are explicit that on macOS
// "the VMP-signing needs to take place BEFORE the code-signing". afterPack runs
// after the app is assembled but before electron-builder signs it, which is the
// only correct slot. (On Windows the order is reversed — not our problem here.)
//
// What it fixes: without VMP signing, the CDM presents castLabs' DEVELOPMENT
// certificate and licence servers refuse it. Amazon Music returns, verbatim:
//   DrmLicenseDeniedException  denialReason: UNTRUSTED_DEVICE_CERTIFICATE
//   Code=DEVELOPMENT_CERTIFICATE_NOT_ALLOWED: development-vmp-certificate-not...
// Playback starts from the buffer and then dies. This is separate from, and
// after, getting the CDM to LOAD at all (see scripts/sign-utility-helper.mjs).
//
// `sign-pkg` takes the DIRECTORY CONTAINING the .app, not the .app itself —
// appOutDir is exactly that.
//
// Failing loudly is deliberate: a build that silently skipped VMP would look
// fine, ship, and reproduce the original bug on someone else's machine.
import { execFileSync } from 'node:child_process'

export default async function vmpSign(context) {
  if (context.electronPlatformName !== 'darwin') return

  // Unsigned local builds (npm run package) don't need a trusted CDM, and
  // signing them would burn EVS tokens for nothing.
  if (process.env.FLIT_SKIP_VMP === '1') {
    console.log('vmp-sign: FLIT_SKIP_VMP=1 — skipping')
    return
  }

  console.log(`vmp-sign: VMP-signing ${context.appOutDir} (before code signing)`)
  try {
    execFileSync('python3', ['-m', 'castlabs_evs.vmp', 'sign-pkg', context.appOutDir], {
      stdio: 'inherit'
    })
  } catch (err) {
    throw new Error(
      'vmp-sign: castLabs VMP signing failed. Widevine playback will be refused by ' +
        'licence servers without it. If the token expired, run:\n' +
        '  python3 -m castlabs_evs.account reauth\n' +
        'To build without it deliberately, set FLIT_SKIP_VMP=1.\n' +
        String(err.message)
    )
  }
  console.log('vmp-sign: done')
}

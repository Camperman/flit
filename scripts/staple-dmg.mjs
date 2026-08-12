// Notarize + staple the DMG *container* and fix its hash in latest-mac.yml.
//
// electron-builder's `mac.notarize` notarizes and staples the .app (so the app
// — and the auto-update zip — pass Gatekeeper offline), and `dmg.sign` signs
// the DMG, but it does NOT notarize/staple the outer DMG container. This runs
// after `npm run dist` to close that gap: it submits the DMG to Apple, staples
// the ticket, then rewrites the DMG's sha512/size in latest-mac.yml (which was
// computed from the pre-staple bytes). Auto-update consumes the zip, not the
// DMG, but keeping the manifest honest avoids a stale hash on the DMG entry.
//
// Requires the same notarization credentials as `npm run dist`
// (APPLE_KEYCHAIN_PROFILE, default "flit").
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const DIST = join(process.cwd(), 'dist')
const profile = process.env.APPLE_KEYCHAIN_PROFILE || 'flit'

// Match the DMG for THIS version explicitly. Taking the first *.dmg silently
// stapled a stale DMG left over from a previous release (v0.7.12 build picked
// up v0.7.11's), shipping the new DMG unstapled.
const { version } = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'))
const candidates = readdirSync(DIST).filter((f) => f.endsWith('.dmg') && f.includes(version))
if (candidates.length === 0) {
  const others = readdirSync(DIST).filter((f) => f.endsWith('.dmg'))
  console.error(
    `staple-dmg: no .dmg for version ${version} in dist/` +
      (others.length ? ` (found: ${others.join(', ')})` : '')
  )
  process.exit(1)
}
if (candidates.length > 1) {
  console.error(`staple-dmg: ambiguous DMGs for ${version}: ${candidates.join(', ')}`)
  process.exit(1)
}
const dmg = candidates[0]
const dmgPath = join(DIST, dmg)

console.log(`staple-dmg: notarizing ${dmg} …`)
execFileSync('xcrun', ['notarytool', 'submit', dmgPath, '--keychain-profile', profile, '--wait'], {
  stdio: 'inherit'
})

console.log(`staple-dmg: stapling ${dmg} …`)
execFileSync('xcrun', ['stapler', 'staple', dmgPath], { stdio: 'inherit' })
execFileSync('xcrun', ['stapler', 'validate', dmgPath], { stdio: 'inherit' })

// Stapling changed the DMG bytes → refresh its entry in latest-mac.yml.
const ymlPath = join(DIST, 'latest-mac.yml')
const buf = readFileSync(dmgPath)
const sha512 = createHash('sha512').update(buf).digest('base64')
const size = buf.length

const lines = readFileSync(ymlPath, 'utf8').split('\n')
let inDmgEntry = false
const out = lines.map((line) => {
  if (line.includes('- url:') && line.includes(dmg)) {
    inDmgEntry = true
    return line
  }
  if (inDmgEntry && /^\s+sha512:/.test(line)) return line.replace(/sha512:.*/, `sha512: ${sha512}`)
  if (inDmgEntry && /^\s+size:/.test(line)) {
    inDmgEntry = false
    return line.replace(/size:.*/, `size: ${size}`)
  }
  return line
})
writeFileSync(ymlPath, out.join('\n'))
console.log(`staple-dmg: updated latest-mac.yml (dmg size ${size})`)

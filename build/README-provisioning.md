# Provisioning profile (required for Touch ID passkeys)

`build/entitlements.mac.plist` requests `keychain-access-groups`, which macOS
treats as **provisioning-profile-backed**. Signing with the Developer ID cert is
not enough: without an embedded profile authorizing it, AMFI kills the app at
launch — exit 137, silently, with no crash report. Measured 2026-09-18 with a
controlled A/B of two otherwise-identical signed builds.

## Two capabilities must be enabled on the App ID FIRST

Before regenerating the profile, open the App ID **com.gottaplaygames.flit** in
https://developer.apple.com/account/resources/identifiers/list and make sure
both are ticked:

- **Keychain Sharing** — backs `keychain-access-groups` (Touch ID credentials)
- **Web Browser Public Key Credential Requests** — backs
  `com.apple.developer.web-browser.public-key-credential`, the Apple-granted
  browser capability that lets Flit ask the SYSTEM passkey store (iCloud
  Keychain, 1Password) for ANY relying-party ID, with no Associated Domain.
  Apple granted this to the account on 2026-09-18; it still has to be switched
  on per App ID.

A profile only carries entitlements that were enabled on the App ID *at the time
the profile was generated*. The first profile (2026-09-21) predates the browser
capability, so it lists only `keychain-access-groups`,
`com.apple.application-identifier` and `com.apple.developer.team-identifier` —
which is why it must be regenerated.

## What to create

In https://developer.apple.com/account/resources/profiles/list → **+**

- Profile type: **Developer ID** (under Distribution), *not* "Developer ID
  Application (Managed)" unless that is the only option offered
- App ID: **com.gottaplaygames.flit**
- Certificate: the **Developer ID Application** cert for Gotta Play Games LLC
  (VZ44XQWQ84)

Download it and save it here as **`build/flit.provisionprofile`** (git-ignored;
it is a signing artifact, not source).

## Verify it before building

    security cms -D -i build/flit.provisionprofile | plutil -p - | grep -A6 Entitlements

The `Entitlements` dict **must** contain BOTH:

- `keychain-access-groups` (expect `VZ44XQWQ84.*`)
- `com.apple.developer.web-browser.public-key-credential` (expect `true`)

If either is missing, do NOT build — the app will be AMFI-killed at launch
(exit 137, silent, no crash report). Remove the corresponding key from
`build/entitlements.mac.plist` instead, and for the browser one also set
`platformPasskeys: false` in `src/main/index.ts`.

For reference, Google Chrome's own profile
(`/Applications/Google Chrome.app/Contents/embedded.provisionprofile`) is a
Developer ID profile (`ProvisionsAllDevices: true`) granting
`keychain-access-groups`, `com.apple.application-identifier`, and
`com.apple.developer.web-browser.public-key-credential`.

## Then

`npm run dist` embeds it at `Contents/embedded.provisionprofile` automatically
(electron-builder `mac.provisioningProfile`).

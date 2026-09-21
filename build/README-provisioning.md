# Provisioning profile (required for Touch ID passkeys)

`build/entitlements.mac.plist` requests `keychain-access-groups`, which macOS
treats as **provisioning-profile-backed**. Signing with the Developer ID cert is
not enough: without an embedded profile authorizing it, AMFI kills the app at
launch — exit 137, silently, with no crash report. Measured 2026-09-18 with a
controlled A/B of two otherwise-identical signed builds.

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

The `Entitlements` dict **must** contain `keychain-access-groups`. If it does
not, the Touch ID path cannot work with this profile and the entitlement must
come off `entitlements.mac.plist` again.

For reference, Google Chrome's own profile
(`/Applications/Google Chrome.app/Contents/embedded.provisionprofile`) is a
Developer ID profile (`ProvisionsAllDevices: true`) granting
`keychain-access-groups`, `com.apple.application-identifier`, and
`com.apple.developer.web-browser.public-key-credential`.

## Then

`npm run dist` embeds it at `Contents/embedded.provisionprofile` automatically
(electron-builder `mac.provisioningProfile`).

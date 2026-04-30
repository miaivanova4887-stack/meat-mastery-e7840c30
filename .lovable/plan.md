
# Fix `assetlinks.json` 404 for Android App Links

## Root cause (verified, not what the bug report assumed)

- `public/.well-known/assetlinks.json` exists in the repo with the correct SHA-256 fingerprint.
- Hitting `https://carnivore-coach-pro.lovable.app/.well-known/assetlinks.json` returns plain `Not found` (NOT the SPA's `index.html`). So the SPA catch-all is **not** intercepting it — the file is simply missing from the deployed bundle.
- Hitting `https://carnivorex.app/.well-known/assetlinks.json` also returns `Not found`. That domain is **not connected as a custom domain** on this Lovable project (only `carnivore-coach-pro.lovable.app` is published).
- Lovable hosting does **not** process `_redirects` or `vercel.json`. Those files would be no-ops here, so steps 2–3 of the bug report don't apply.

Two real problems to fix:

1. The published build doesn't include `.well-known/assetlinks.json` (likely because the site was last published before this file was added, and/or Vite/the build pipeline isn't picking up the dotfile dir).
2. Even once it's served, Android validates against `https://carnivorex.app/...`, which isn't a domain on this project yet.

## Changes

### 1. Guarantee Vite ships the dotfile directory

Update `vite.config.ts` to explicitly include `public/.well-known/**` as a static asset. Vite's default `publicDir` copy normally handles this, but to be defensive (and to make the intent explicit) add:

```ts
// vite.config.ts
build: {
  // ensures dot-prefixed paths under public/ are emitted to dist/
  copyPublicDir: true,
  assetsInclude: ['**/.well-known/**'],
},
publicDir: 'public',
```

Also add a tiny build-time sanity script (logged in the plugin output) that fails the build if `dist/.well-known/assetlinks.json` is missing after build, so this regression can't happen silently again.

### 2. Verify the file is byte-perfect

Re-confirm `public/.well-known/assetlinks.json` matches Google's expected schema (it already does: array root, `delegate_permission/common.handle_all_urls`, correct package name `com.mi4labs.carnivorex`, 32-pair SHA-256 fingerprint). No edit needed to the file itself unless the SHA-256 below is the **debug** keystore rather than the **release/upload** keystore — see "User actions" §2.

### 3. NOT changing

- No `_redirects` file (Lovable hosting ignores it).
- No `vercel.json` (not used).
- No SPA route exception in `App.tsx` — React Router never sees `/.well-known/...`; that path is handled by the static file server before SPA fallback.

## User actions required (cannot be done from code)

1. **Republish** the project (Publish → Update) so the new `dist/.well-known/assetlinks.json` is uploaded to the CDN.
2. **Confirm the SHA-256 fingerprint** in `public/.well-known/assetlinks.json` matches the keystore that signs the APK uploaded to Play Console:
   - For Play-signed apps, get the SHA-256 from **Play Console → Setup → App integrity → App signing key certificate**.
   - For self-signed APKs, run: `keytool -list -v -keystore <release.keystore> -alias <alias>` and copy the SHA256.
   - The current file has `A7:2B:BF:...:CE:A1` — verify this is the **release/upload** key, not the debug key.
3. **Connect `carnivorex.app` as a custom domain** on this Lovable project (Project Settings → Domains). Android verifies App Links against the exact host configured in `AndroidManifest.xml` (`carnivorex.app`), so until that domain serves the file, deep-link auto-verification will not pass and Android will keep showing the "Open with…" chooser.

## Verification

After republish + domain connection:

```bash
curl -i https://carnivorex.app/.well-known/assetlinks.json
# expect: HTTP/2 200, content-type: application/json, JSON body
```

Then on the device:

```bash
adb shell pm verify-app-links --re-verify com.mi4labs.carnivorex
adb shell pm get-app-links com.mi4labs.carnivorex
# expect: carnivorex.app  verified
```

## Files touched

- `vite.config.ts` — explicit `copyPublicDir` + post-build assertion.

No other code changes needed. The bug as described (SPA catch-all eating the request) isn't what's happening; the fix is build-output + domain wiring.


## Root cause

Android App Link verification for `app.carnivorex.app` is failing because the installed APK is signed with the **debug** keystore, but `public/.well-known/assetlinks.json` only lists the **release** SHA-256 fingerprint. Android therefore marks the link unverified and opens it in Chrome instead of handing off to the CarnivoreX app.

The email flow, manifest, deep-link handler, and resume-time session refresh are all already correct.

## Changes

### 1. Add the debug SHA-256 to `assetlinks.json`

Update `public/.well-known/assetlinks.json` to include **both** the release fingerprint (already present) and the debug keystore fingerprint, so debug installs (sideloaded APKs from `./gradlew assembleDebug` or Android Studio runs) are also verified:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.mi4labs.carnivorex",
    "sha256_cert_fingerprints": [
      "A7:2B:BF:99:5D:D5:1D:0C:03:F0:4B:4F:24:CF:BF:93:7A:9B:6E:7F:FD:60:EB:00:B0:F7:83:4C:9F:F2:CE:A1",
      "<DEBUG_SHA256_HERE>"
    ]
  }
}]
```

You will need to provide the debug SHA-256 by running on your Mac:
```
keytool -list -v -keystore ~/.android/debug.keystore \
  -alias androiddebugkey -storepass android -keypass android \
  | grep "SHA256:"
```
Paste that fingerprint into the plan reply (or directly into the file) and I will commit it.

### 2. Clean residual "Carnivore Coach Pro" / "carnivore-coach-pro" strings

Search and replace remaining brand drift in:
- `capacitor.config.json` → `appName: "CarnivoreX"`
- Any remaining occurrences in `supabase/functions/_shared/email-templates/*.tsx` (footer/from-name)
- `index.html` `<title>` if still stale

### 3. No code changes needed

- `AndroidManifest.xml` — already correct.
- `src/hooks/useDeepLinks.ts` — already refreshes the Supabase session on `resume`, so even if the user verifies in Chrome, returning to the APK will detect the verified state and route them in.
- `src/contexts/AuthContext.tsx` — already pinned to `https://app.carnivorex.app/auth/callback`.

## After the change — required user steps

1. **Republish** the web project so the updated `assetlinks.json` is live at `https://app.carnivorex.app/.well-known/assetlinks.json`.
2. Verify it serves both fingerprints:
   ```
   curl -s https://app.carnivorex.app/.well-known/assetlinks.json
   ```
3. On the device:
   - Uninstall the current APK (so Android re-verifies on install).
   - Reinstall the debug APK.
   - Optionally force re-verification:
     ```
     adb shell pm verify-app-links --re-verify com.mi4labs.carnivorex
     adb shell pm get-app-links com.mi4labs.carnivorex
     ```
     Look for `app.carnivorex.app: verified`.
   - In Settings → Apps → CarnivoreX → Open by default → ensure "Open supported links" is ON and `app.carnivorex.app` is listed.
4. Trigger a fresh signup with a new email. The verification link should now open the app directly. If a user is on a build whose SHA isn't listed, Chrome will still open — and the existing `resume` listener will pick up the verified session when they switch back to the app.

## Technical notes

- Listing multiple SHA-256s in `assetlinks.json` is fully supported and is the standard pattern for shipping debug + release builds against the same domain.
- Once you ship via Play Store, also add the **Play App Signing** SHA-256 from Play Console → Setup → App integrity. Without it, Play-signed installs would Chrome-fallback the same way.


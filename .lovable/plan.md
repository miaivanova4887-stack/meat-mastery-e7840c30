## Root cause

- Live `https://app.carnivorex.app/.well-known/assetlinks.json` still serves only the **release** SHA-256 fingerprint. The debug fingerprint (`85:EE:54:…:B8`) is in the source file but the published web app hasn't been republished, so Android cannot verify the debug-signed APK against the live asset statement.
- The APK currently installed on the device was built before `AndroidManifest.xml` was updated. Its baked-in intent-filter still claims `host="carnivorex.app"` (bare root) — that is why `pm get-app-links` reports `carnivorex.app: 1024` instead of `app.carnivorex.app`.
- Source code itself is consistent: manifest, Capacitor config, AuthContext, AuthCallback, useDeepLinks (App resume → `refreshSession`) all correctly target `app.carnivorex.app`. No code changes needed for the App Link plumbing.
- Separately, auth emails are still branded `carnivore-coach-pro` because `SITE_NAME` in `supabase/functions/auth-email-hook/index.ts` was never renamed to `CarnivoreX`.

## What this plan does

1. **Rename the email brand** from `carnivore-coach-pro` to `CarnivoreX` in the auth-email hook. Updates the `From` display name and the `siteName` passed into every auth email template (signup, magic link, recovery, invite, email change, reauthentication).

2. **Republish the web project** so the live `assetlinks.json` finally includes both fingerprints (release + debug). This is the single change that unblocks verification — the source file is already correct.

3. **Provide a fresh build + reinstall command sequence** for the user to run locally. The previous attempt failed because the user typed the path with a duplicate `android/` prefix while already inside `android/`, so the new APK wasn't actually installed.

## Files to change

- `supabase/functions/auth-email-hook/index.ts` — `SITE_NAME = "CarnivoreX"`. Everything downstream picks it up automatically.

No other source changes. The Android manifest, Capacitor config, AuthContext, AuthCallback, useDeepLinks, and `public/.well-known/assetlinks.json` are already correct.

## After implementation — user must run locally

From the project root (NOT inside `android/`):

```text
npm run build
npx cap sync android
cd android
./gradlew clean assembleDebug
adb uninstall com.mi4labs.carnivorex
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell pm verify-app-links --re-verify com.mi4labs.carnivorex
adb shell pm get-app-links com.mi4labs.carnivorex
```

Expected output of the final command:

```text
Domain verification state:
  app.carnivorex.app: verified
```

Then sign up with a fresh email — the verification link should open directly in the CarnivoreX app, and on `resume` the session will auto-refresh so the verified state is detected immediately even if the user briefly bounced through Chrome.

## Verification checklist

- `curl -s https://app.carnivorex.app/.well-known/assetlinks.json` returns BOTH SHA-256 fingerprints after republish.
- `pm get-app-links` reports host `app.carnivorex.app` (not bare `carnivorex.app`) → confirms the new manifest is actually installed.
- State transitions from `1024` (no response / unverifiable) to `verified`.
- Next signup email arrives From `CarnivoreX <noreply@notify.carnivorex.app>` instead of `carnivore-coach-pro`.

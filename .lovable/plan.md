## Goal

Fix Android Google sign-in by routing the OAuth callback through the custom URL scheme `carnivorex://auth/callback` instead of the HTTPS App Link `https://app.carnivorex.app/auth/callback`. The HTTPS App Link path is failing to deliver the callback back into the WebView (the resume event fires with no session and `deeplink:appUrlOpen` never logs).

The custom scheme is already wired up in `android/app/src/main/AndroidManifest.xml` via the standard Capacitor intent filter, and `useDeepLinks` already routes `/auth/callback` deep links into the React app, so no native changes are needed.

## Changes

### 1. `src/pages/Auth.tsx` — `handleOAuthSignIn` (lines 113–153)

Replace the current `redirectTo` computation with explicit per-platform branching:

```ts
const platform = Capacitor.getPlatform(); // "web" | "android" | "ios"
const redirectTo =
  platform === "web"
    ? `${window.location.origin}/auth/callback`
    : "carnivorex://auth/callback"; // android + ios
```

Everything else in the function (logging, `lovable.auth.signInWithOAuth`, error toast, navigation) stays the same. The existing `oauth:redirect-uri` log will now show `carnivorex://auth/callback` on device, which is the verification signal.

### 2. `src/main.tsx` — bump build marker

Change `authFlow=v3-oauth-diag` → `authFlow=v4-custom-scheme` so we can confirm the new bundle is what's running on device (the failing log shows `v3-oauth-diag`, proving the build marker check is the reliable way to verify the install).

### 3. `scripts/build-android-fresh.sh` — update `REQUIRED_MARKERS`

Update the expected marker string to `authFlow=v4-custom-scheme` so the post-build assertion fails loudly if the new bundle isn't packaged.

## Out of scope (no code change needed)

- `src/pages/AuthCallback.tsx` already handles the PKCE `?code=…` exchange added in the previous round — it will run as soon as `useDeepLinks` forwards `carnivorex://auth/callback?code=…` to the in-app `/auth/callback` route.
- `useDeepLinks` already listens for `appUrlOpen` and routes `/auth/callback` paths.
- `AndroidManifest.xml` already declares the `com.mi4labs.carnivorex` / `carnivorex` custom scheme intent filter from Capacitor defaults.
- iOS: the same custom scheme will work once iOS is built; no separate logic needed.

## Required Supabase configuration (manual, outside the codebase)

In **Lovable Cloud → Authentication → URL Configuration → Redirect URLs**, add:

```
carnivorex://auth/callback
```

Keep the existing `https://app.carnivorex.app/auth/callback` and `https://carnivore-coach-pro.lovable.app/auth/callback` entries for web. Without this allowlist entry, the OAuth broker will reject the redirect and the user will land on an error page instead of the app.

## Verification after rebuild

```
npm run apk:fresh:debug
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb logcat -c && adb logcat -v time | grep -E 'BuildInfo|AuthVerify|oauth:'
```

Tap **Continue with Google**. Expected new log sequence:

```text
BuildInfo … authFlow=v4-custom-scheme
oauth:click          { provider: "google", platform: "android", isNative: true }
oauth:redirect-uri   { redirectTo: "carnivorex://auth/callback" }   ← key change
oauth:signIn-result  { redirected: true, hasError: false }
deeplink:appUrlOpen  { redacted: "carnivorex://auth/callback?code=[redacted:…]" }
callback:start
oauth:exchange-call  { hasCode: true, codeFp: "len=… head=…" }
oauth:exchange-result{ hasSession: true, hasUser: true, errMessage: null }
```

If `deeplink:appUrlOpen` still doesn't fire after the redirect, the failure is on the Supabase Redirect URL allowlist (step above) — the broker will have refused to redirect to the custom scheme.

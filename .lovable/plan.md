## Goal

Get full visibility into the Android Google sign-in failure by tagging every hop with `[AuthVerify]` logs that already pipe into logcat (visible via `adb logcat | grep AuthVerify`) and into the on-screen diagnostics panel on `/auth/callback`.

Apple button visibility is already correctly gated to iOS only — no UI changes.

## What gets logged

For each Google sign-in attempt, the user (and adb) will see a sequence like:

```text
[AuthVerify] oauth:click            { provider: "google", platform: "android", isNative: true }
[AuthVerify] oauth:redirect-uri     { redirectTo: "https://app.carnivorex.app/auth/callback" }
[AuthVerify] oauth:signIn-result    { redirected: true,  hasError: false, hasTokens: false }
[AuthVerify] deeplink:appUrlOpen    { redacted: "carnivorex://auth/callback?code=[redacted:...]" }
[AuthVerify] callback:start         { url: "...", hashHasAccessToken: false }
[AuthVerify] oauth:exchange-call    { hasCode: true, codeFp: "len=43 head=4/0…" }
[AuthVerify] oauth:exchange-result  { hasSession: true,  hasUser: true,  errMessage: null }
```

If anything fails, the matching line carries `errName / errStatus / errCode / errMessage` so we can pinpoint whether the breakage is at the click, the redirect, the broker, the deep link, or the PKCE code exchange.

## Files to change

1. **`src/pages/Auth.tsx`** — `handleOAuthSignIn`
   - Import `Capacitor` (already imported for the Apple gate) and `logAuthDiag` from `@/lib/authDiagnostics`.
   - Compute `redirectTo` once and log it before calling `lovable.auth.signInWithOAuth`.
     - Native Android: keep custom-scheme deep link `carnivorex://auth/callback` (matches the `assetlinks.json` / intent filter you already verified).
     - Web: `${window.location.origin}/auth/callback`.
   - Log `oauth:click`, `oauth:redirect-uri`, then `oauth:signIn-result` with `{ redirected, hasError, hasTokens, errMessage }`.
   - Apply the same change to both `google` and `apple` paths (Apple stays hidden on Android, so this only fires on iOS).

2. **`src/integrations/lovable/index.ts`**
   - This file is auto-generated and must not be hand-edited. Instead, the diagnostics for the inner `setSession` step are captured indirectly: the wrapper returns `{ error }` on failure, which `Auth.tsx` already surfaces via `oauth:signIn-result`. No edit here.

3. **`src/hooks/useDeepLinks.ts`**
   - Already logs `deeplink:appUrlOpen` and `deeplink:launch-url` (raw OAuth callback URL is captured in redacted form). No change needed — these entries cover the "raw OAuth callback URL received by the app" requirement.

4. **`src/pages/AuthCallback.tsx`**
   - Add a new branch at the top of `finalize()` that detects an OAuth `code` query param (PKCE) and logs the exchange:
     - `oauth:exchange-call` with `{ hasCode, codeFp }` (uses existing `fingerprint` helper, never logs the raw code).
     - Calls `supabase.auth.exchangeCodeForSession(window.location.href)`.
     - `oauth:exchange-result` with `{ hasSession, hasUser, userVerified, errName, errStatus, errCode, errMessage }`.
     - On success, navigate to `/` (same pattern as the existing hash-token branch).
   - This branch runs before the existing `verifyOtp` path so email-link verification is unaffected.

5. **`src/main.tsx`**
   - Bump the build marker from `authFlow=v2-verifyOtp` to `authFlow=v3-oauth-diag` so the build script's `REQUIRED_MARKERS` check confirms the new bundle is the one running on device.

6. **`scripts/build-android-fresh.sh`**
   - Update `REQUIRED_MARKERS` to expect `authFlow=v3-oauth-diag`.

## How to verify after rebuild

1. `npm run apk:fresh:debug && adb install -r android/app/build/outputs/apk/debug/app-debug.apk`
2. `adb logcat -c && adb logcat -v time | grep -E 'BuildInfo|AuthVerify'`
3. Tap **Continue with Google** on Android.
4. Expected log sequence:
   - `BuildInfo … authFlow=v3-oauth-diag`
   - `oauth:click platform=android`
   - `oauth:redirect-uri redirectTo=…`
   - `oauth:signIn-result redirected=true` (browser opens)
   - After Google consent: `deeplink:appUrlOpen` with the redacted callback URL
   - `callback:start`
   - `oauth:exchange-call` + `oauth:exchange-result`
5. Whichever line shows `hasError:true` / non-null `errMessage` identifies the failure point. Share that block and we'll fix it next.

## What is NOT changing

- Apple button visibility (already iOS-only).
- Email verification flow (`verifyOtp` branch is untouched).
- `src/integrations/lovable/index.ts` (auto-generated).
- Any RLS, edge function, or database config.

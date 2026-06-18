# Fix: Android Google re-login hangs on infinite buffering

## Root cause (traced, not guessed)

The Android Google sign-in is a manual flow:

1. `src/pages/Auth.tsx` → `handleOAuthSignIn("google")` calls `supabase.auth.signInWithOAuth({ skipBrowserRedirect: true })`, then opens the returned URL in the in-app browser with `Browser.open({ url, windowName: "_self" })`.
2. After Google redirects back via `carnivorex://callback`, `src/hooks/useDeepLinks.ts` receives the deep link and is responsible for calling `Browser.close()` to dismiss the in-app browser so the app becomes visible again.

The bug is in `src/hooks/useDeepLinks.ts`:

```text
let browserCloseAttempted = false;   // module-level, set once, NEVER reset
...
if (isOAuthCallback) {
  ...
  if (!browserCloseAttempted) {
    browserCloseAttempted = true;     // flips true on FIRST login
    void Browser.close()...
  }
}
```

`browserCloseAttempted` is a module-level variable. The app is a single-page app, so the JS runtime is **not** restarted on logout. After the first Google login it is permanently `true`.

On the **second** Google login (after logout), the OAuth deep link arrives, the session is actually installed in the background, but `Browser.close()` is **skipped** because the flag is still `true`. The in-app browser (Chrome Custom Tab / Capacitor Browser) stays in the foreground showing Google's spinning "redirecting…" page on top of the app — exactly the reported "infinite buffering, no error, never completes."

This is also why no error is shown: auth succeeds silently behind the browser overlay; only the overlay is stuck.

Secondary hardening: the Google in-flight markers in `src/lib/oauthFlowState.ts` and the short-dedupe vars are fine, but the browser-close guard must be tied to a single OAuth attempt rather than to the whole app lifetime.

## Fix

### 1. `src/hooks/useDeepLinks.ts` — make the browser-close guard per-flow, not per-runtime

- Remove the permanent `browserCloseAttempted` latch. Instead, key the dedupe off the callback fingerprint (`fp`) that already exists, so each *distinct* OAuth callback closes its browser exactly once, while rapid duplicate `appUrlOpen` bursts for the *same* callback are still de-duped.
- Concretely: replace `let browserCloseAttempted = false;` with `let lastBrowserClosedFp: string | null = null;`, and in the `isOAuthCallback` branch close the browser when `lastBrowserClosedFp !== fp`, then set `lastBrowserClosedFp = fp`.
- This guarantees the in-app browser is dismissed on every new login attempt (each has a unique token/code → unique `fp`), permanently fixing the second-login hang.

### 2. `src/lib/oauthFlowState.ts` — reset in-flight state defensively

- `markGoogleOAuthInFlight()` already overwrites the flag, so re-login is safe; no change strictly required. Leave as-is.

### 3. `src/contexts/AuthContext.tsx` — confirm clean logout (no code change expected)

- `signOut()` calls `supabase.auth.signOut()`, `onAuthStateChange` fires `SIGNED_OUT`, which sets `session=null`, `user=null`, `loading=false`. The reconcile ref is per-user-id and re-arms correctly on next sign-in. This path is already correct; verified during tracing. No change needed unless validation reveals otherwise.

### 4. `src/pages/Auth.tsx` — confirm loading flag safety (no code change expected)

- The local `loading` state is component state (reset on mount) and the native path intentionally leaves it `true` because the app backgrounds into the browser. With the browser now closing correctly, the Auth screen unmounts on successful navigation, so no stale spinner persists. No change needed.

## Why this is the minimal correct fix

The only thing that behaves differently between the first and second login is module-level state that survives logout. `browserCloseAttempted` is the single variable that gates the user-visible browser dismissal and is never reset. Fixing it restores identical behavior for every login attempt.

## Validation

- Build passes (type-check).
- Re-read `useDeepLinks.ts` to confirm the new fingerprint-keyed close logic and that no other `browserCloseAttempted` reference remains.
- Logic walk-through of: login → logout → login, confirming `Browser.close()` now runs on the second callback (distinct `fp`).
- Note: full proof requires a native APK run (per project verification standards). After the code fix, the on-device check is: log in with Google, log out, log in with Google again — the in-app browser should close and land in the app both times.

## Files changed

- `src/hooks/useDeepLinks.ts` — replace the permanent `browserCloseAttempted` latch with a per-callback (`fp`-keyed) browser-close guard.

Before implementing, confirm how fp is computed in useDeepLinks.ts. It must be derived from the unique OAuth code or state URL parameter so that every new login attempt produces a distinct fp. If it is derived from anything static or time-based, the fingerprint logic needs to be updated to use the OAuth code parameter instead.
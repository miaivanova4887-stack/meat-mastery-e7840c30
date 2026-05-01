# Fix: native OAuth callback path mismatch (`/callback` vs `/auth/callback`)

Logcat confirmed Google OAuth returns to `carnivorex:///callback#access_token=...`, but `useDeepLinks` only treats `/auth/callback` as auth, so the deep link is dropped and the session is never installed.

## Changes

### 1. `src/hooks/useDeepLinks.ts`
- Treat `/callback` as an auth route alongside `/auth/callback` (and `/reset-password`).
- Close the in-app `Browser` for either OAuth callback path (`/callback` or `/auth/callback`).
- Route the deep link into React Router exactly as today (preserving `search` + `hash`, replacing history first when a hash is present so `AuthCallback` can read it via `window.location.hash`).

### 2. `src/App.tsx`
- Add a second route `<Route path="/callback" element={<AuthCallback />} />` so React Router renders the same component for the new path. (Required — currently only `/auth/callback` is registered.)

### 3. `src/pages/AuthCallback.tsx`
- No path-specific logic exists today; it already reads `window.location.hash` and `originalUrlRef.current`, so both PKCE `?code=` and hash-token (`#access_token=…`) flows already work regardless of the pathname.
- Update the two `window.history.replaceState(null, "", "/auth/callback")` calls to preserve the current pathname instead of hard-coding `/auth/callback`, so a `/callback` URL stays `/callback` after token cleanup. Use `window.location.pathname` as the target.

### 4. `src/pages/Auth.tsx`
- For native (`isNative`) Google/Apple OAuth, change `redirectTo` from `"carnivorex://auth/callback"` to `"carnivorex://callback"`.
- Web path (`platform === "web"`) stays on `${window.location.origin}/auth/callback` — unchanged.
- Leave the email-resend `emailRedirectTo` (`https://app.carnivorex.app/auth/callback`) unchanged — that's an HTTPS App Link for email confirmation, not the native OAuth callback.

### 5. `src/main.tsx`
- Bump build marker string: `authFlow=v6-browser-plugin` → `authFlow=v7-callback-path-fix`. Keep `authVerifyTag=oauth:exchange-call`.

### 6. `scripts/build-android-fresh.sh`
- In `REQUIRED_MARKERS`, replace `"authFlow=v6-browser-plugin"` with `"authFlow=v7-callback-path-fix"` so a stale bundle aborts the build.

## Out of scope / NOT changed
- Supabase Auth → URL Configuration must include `carnivorex://callback` in the Redirect URLs allowlist. (User-side dashboard config — flag this in the follow-up message; no code change can fix it.)
- `AndroidManifest.xml` intent filters: the existing `carnivorex://` scheme filter already matches both `/callback` and `/auth/callback` (path is not constrained for the custom scheme), so no manifest edit is needed. Will verify during implementation; if the filter pins a path, add `<data android:scheme="carnivorex" android:host="callback" />`.
- No changes to `AuthContext`, edge functions, or email templates.

## Expected logs after rebuild
```
[BuildInfo] ... authFlow=v7-callback-path-fix
[AuthVerify] oauth:redirect-uri {"redirectTo":"carnivorex://callback"}
[AuthVerify] deeplink:appUrlOpen {"redacted":"carnivorex://callback#access_token=..."}
[AuthVerify] deeplink:received {"pathname":"/callback","isAuthRoute":true,...}
[AuthVerify] callback:start ...
[AuthVerify] callback:hash-refresh {"hasSession":true,...}
```

## Action required from you (parallel to code change)
In Lovable Cloud → Auth → URL Configuration → Redirect URLs, add:
```
carnivorex://callback
```
(keep `carnivorex://auth/callback` too for safety during the transition).

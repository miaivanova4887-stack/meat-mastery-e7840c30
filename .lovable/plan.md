I’ll implement a focused hardening pass across the existing Capacitor + auth flow to eliminate stale callback behavior and prevent indefinite loading.

## Planned changes

1. Normalize all native OAuth callback formats

- Add an exported `normalizeAuthCallbackUrl(rawUrl)` helper in `src/hooks/useDeepLinks.ts`.
- It will recognize and normalize all accepted native callback shapes:
  - `carnivorex://callback#...` → `/callback`
  - `carnivorex:///callback#...` → `/callback`
  - `carnivorex://auth/callback#...` → `/callback` or `/auth/callback` as a valid auth route
- It will not rely only on `new URL(...).pathname`; it will inspect `protocol`, `host`, `pathname`, and a raw-string fallback for `carnivorex:///callback`.
- Deep-link logs will include `protocol`, `host`, `pathname`, `normalizedPath`, and `isAuthRoute`.

2. Keep redirect source-of-truth strict

- In `src/pages/Auth.tsx`, ensure native OAuth always uses exactly:
  - `carnivorex://callback`
- Keep web OAuth on:
  - `${window.location.origin}/auth/callback`
- Update comments to document the required backend redirect allowlist entries:
  - `carnivorex://callback`
  - `carnivorex://auth/callback`

3. Route both current and legacy callbacks

- Keep `src/App.tsx` routes for both:
  - `/callback`
  - `/auth/callback`
- Keep AndroidManifest support for both custom scheme hosts:
  - `scheme=carnivorex host=callback`
  - `scheme=carnivorex host=auth`
- Add/update native comments so future builds do not remove either host.

4. Install OAuth sessions from callback tokens immediately

- In `src/pages/AuthCallback.tsx`, parse `access_token` and `refresh_token` from both hash and query string.
- If both tokens exist, immediately call:
  - `supabase.auth.setSession({ access_token, refresh_token })`
- Log:
  - `callback:setSession-start`
  - `callback:setSession-success`
  - `callback:setSession-error`
- On success, close the native browser, clean token fragments from history, clear the loading state, and navigate to `/`.
- Only fall back to code exchange / OTP verification / getSession / refreshSession when direct tokens are not present.

5. Prevent resume refresh from racing callback processing

- Add a small shared auth-callback-in-progress guard, likely in `src/lib/authDiagnostics.ts` or a dedicated auth-flow utility.
- `AuthCallback.tsx` will mark callback processing active while it parses and installs tokens.
- `useDeepLinks.ts` resume handler will skip `supabase.auth.refreshSession()` while this flag is active, preventing `Auth session missing!` from racing and corrupting the flow.

6. Add an 8-second failsafe instead of infinite Loading

- `AuthCallback.tsx` will switch from endless `working` to a visible recoverable error after 8 seconds.
- The UI will provide:
  - Retry
  - Back to Sign In
  - diagnostics panel already used by the page
- I’ll also review `AuthContext.tsx` bootstrap so it clears loading after `getSession()` failure/no-session and treats both `/auth/callback` and `/callback` as callback routes.

7. Protect email/password recovery path

- Confirm `signInWithPassword` does not depend on deep-link state.
- Add/adjust defensive logging and error handling so successful email/password sign-in clears component loading and navigates normally.
- If no session exists, the app should render sign-in state instead of stale loading.

8. Stronger stale-build detection

- In `src/main.tsx`, bump the log marker to exactly:
  - `authFlow=v8-normalized-callback-parser`
- In `scripts/build-android-fresh.sh`, update required marker checks and install instructions to require v8 and the new callback markers, so stale v6/v7 bundles fail the script.
- Keep the script checking for stale auth markers where useful.

9. Verification comments and expected logs

- Add concise comments near the auth callback code with the accepted callback formats and expected good log sequence:
  - `[BuildInfo] ... authFlow=v8-normalized-callback-parser`
  - `oauth:redirect-uri {"redirectTo":"carnivorex://callback"}`
  - `deeplink:appUrlOpen ...`
  - `deeplink:received ... "normalizedPath":"/callback","isAuthRoute":true`
  - `callback:setSession-start`
  - `callback:setSession-success`
  - navigation to authenticated route

## Files to modify

- `src/hooks/useDeepLinks.ts`
- `src/pages/AuthCallback.tsx`
- `src/pages/Auth.tsx`
- `src/App.tsx`
- `src/main.tsx`
- `android/app/src/main/AndroidManifest.xml`
- `scripts/build-android-fresh.sh`
- `src/contexts/AuthContext.tsx` if needed for callback-route and bootstrap failsafe hardening
- `src/lib/authDiagnostics.ts` or a small utility file for the shared callback-in-progress guard

Proceed and apply the code changes now.

Two priorities:

1. Make the runtime log show:

   [BuildInfo] ... authFlow=v8-normalized-callback-parser

   oauth:redirect-uri {"redirectTo":"carnivorex://callback"}

   deeplink:received ... "normalizedPath":"/callback","isAuthRoute":true

   callback:setSession-start

   callback:setSession-success

2. Prevent infinite loading no matter what:

   if callback processing fails or times out, render a recoverable error UI and return to sign-in cleanly.

After editing, return:

- file-by-file summary

- exact lines/strings added for:

  - v8-normalized-callback-parser

  - carnivorex://callback

  - Route path="/callback"

  - normalizeAuthCallbackUrl

  - callback:setSession-start

  - callback:setSession-success

- any required Supabase dashboard redirect URLs

Do not stop at the plan stage; modify the files directly.

## After implementation

I’ll provide a concise summary with:

- each file changed
- exact native `redirectTo`
- exact build marker
- exact callback patterns recognized
- exact expected adb log lines

You’ll still need the backend redirect allowlist to include both custom scheme entries:

- `carnivorex://callback`
- `carnivorex://auth/callback`
Do I know what the issue is? Yes.

Root cause audit

- The active repeat path is `src/hooks/useDeepLinks.ts`, specifically:
  - `src/hooks/useDeepLinks.ts:114-120`: `CapApp.getLaunchUrl()` is still consumed on every fresh WebView/JS bootstrap.
  - `src/hooks/useDeepLinks.ts:101-105`: every consumed launch URL writes the token fragment back into the WebView URL with `history.replaceState(..., /callback#access_token...)`, then navigates to the callback route.
  - `src/pages/AuthCallback.tsx:121-185`: every callback mount then sees the same hash tokens and calls `supabase.auth.setSession()` again.
- The repeated diagnostics prove the previous guard is not surviving the actual failure mode:
  - `oauth:browser-close-error` repeats. In current source, `browserCloseAttempted` at `src/hooks/useDeepLinks.ts:34` should allow this only once per JS runtime.
  - `deeplink:launch-url` repeats, while `deeplink:launch-url-skip-already-processed` never appears. In current source, `launchUrlProcessed` at `src/hooks/useDeepLinks.ts:30` should suppress later calls in the same JS runtime.
  - `callback:start` and `callback:setSession-success` repeat, while `callback:skip-duplicate-fp` never appears. In current source, `lastFinalizedFp` at `src/pages/AuthCallback.tsx:21` should suppress repeat finalization in the same JS runtime.
- Therefore, this is not just a React route remount. A normal React remount would keep the module-level variables alive. The logs show those variables are reset between loop iterations, meaning the WebView JavaScript runtime is being reinitialized or the shipped JS bundle is not the one containing the guards.
- The exact line that still causes repeat processing after each reset is `src/hooks/useDeepLinks.ts:116` (`CapApp.getLaunchUrl()`), because Capacitor/iOS continues returning the same original OAuth launch URL. Since the one-shot flag is only module memory, it becomes `false` again whenever the runtime reloads, so the same launch URL is re-consumed and re-routed.

Why the previous dedupe did not stop it

- It is implemented only with module-level variables:
  - `launchUrlProcessed`
  - `lastHandledAuthFp`
  - `browserCloseAttempted`
  - `lastFinalizedFp`
  - `isFinalizing`
- Those are valid for duplicate events inside one JS runtime, but they do not survive a WebView reload, native bridge re-bootstrap, or loading a stale native bundle. Your log cadence and repeated `Browser.close()` attempts prove the loop crosses that boundary.
- The callback is also being sanitized too late. `useDeepLinks` writes `/callback#access_token...` into the WebView URL before `AuthCallback` can process it. If the runtime restarts before or during cleanup, the app boots again on a token-bearing callback URL and the loop repeats.

Router/auth listener findings

- Router setup:
  - `src/App.tsx:147` mounts `DeepLinkHandler` inside `BrowserRouter`.
  - `src/App.tsx:171-172` maps both `/auth/callback` and `/callback` to `AuthCallback`.
  - There is no alternate callback route found that bypasses `AuthCallback`.
- Auth-state listener:
  - `src/contexts/AuthContext.tsx:107-124` updates session/user and does not navigate to `/callback`.
  - `src/contexts/AuthContext.tsx:126-141` initial `getSession()` also does not navigate to `/callback`.
  - So there is no auth-state listener redirecting back into `/callback`.
- Other `CapApp.getLaunchUrl()` usage:
  - Search found only `src/hooks/useDeepLinks.ts:116`.
- Custom-scheme conversion:
  - `src/lib/authCallbackGuard.ts` normalizes `carnivorex://callback` to `/callback`.
  - `src/hooks/useDeepLinks.ts:101-105` is the code that converts the native callback into the WebView route `capacitor://localhost/callback#...` by calling `history.replaceState` + React `navigate`.

Build tag confirmation

- The source contains `authFlow=v9-callback-dedupe` at `src/main.tsx:16`.
- The diagnostics you pasted do not include it.
- That alone is not conclusive because the tag is currently logged only when `import.meta.env.DEV` is true, so a normal production iOS build will not emit it. But the absence of the new dedupe tags (`deeplink:launch-url-skip-already-processed`, `deeplink:dedupe-skip`, `callback:skip-duplicate-fp`) plus repeated `Browser.close()` attempts strongly indicates the active runtime is either resetting between attempts or not loading the intended guarded bundle.

Corrected plan

1. Move callback dedupe from module memory to persistent, pre-route storage
  - Add a shared guard in `src/lib/authCallbackGuard.ts` that fingerprints the OAuth callback and records it in `sessionStorage`/`localStorage` before routing.
  - Use the access/refresh token fingerprint, not the whole URL origin, so `carnivorex://callback#...` and `capacitor://localhost/callback#...` resolve to the same processed callback.
  - Keep a short TTL so a genuinely new login attempt still works.
2. Stop re-routing already-consumed launch URLs at the deep-link layer
  - In `src/hooks/useDeepLinks.ts`, before `history.replaceState` or `navigate`, call the persistent guard.
  - If already consumed, log a new unmistakable tag such as `deeplink:persistent-consumed-skip` and return.
  - This fixes the real repeated line: `CapApp.getLaunchUrl()` may still return the stale URL, but it will no longer be allowed to route it into `/callback` again.
3. Stop writing token fragments into browser history more than necessary
  - Change `src/hooks/useDeepLinks.ts:101-105` so it does not call `window.history.replaceState` with `/callback#access_token...`.
  - Route React to `/callback` using router state or a temporary storage handoff for the raw callback URL.
  - This prevents the WebView address from being left at `capacitor://localhost/callback#access_token...` if anything restarts mid-flow.
4. Make `AuthCallback` idempotent across runtime resets
  - In `src/pages/AuthCallback.tsx`, read the raw callback from the shared handoff first, falling back to `window.location.href` only if needed.
  - Before `setSession()`, check the same persistent fingerprint guard.
  - After `setSession-success`, mark the fingerprint completed before any toast/navigation cleanup.
  - If a completed callback is seen again, skip `setSession()` and go to `/` without touching `history.replaceState`.
5. Add production-visible verification tags
  - Move the auth-flow build tag out of the `import.meta.env.DEV` block or add a redacted `logAuthDiag("build:auth-flow", { version: "v10-persistent-callback-guard" })` on startup.
  - This will make the copied AuthVerify diagnostics prove whether the intended code path is active in a production iOS build.

Exact files to change

- `src/lib/authCallbackGuard.ts`
  - Add persistent fingerprint helpers and callback handoff helpers.
- `src/hooks/useDeepLinks.ts`
  - Gate `CapApp.getLaunchUrl()`/`appUrlOpen` handling with persistent dedupe before routing.
  - Remove the pre-callback token-fragment `history.replaceState` call.
  - Store the raw callback URL for `AuthCallback` instead of pushing the full token hash into the visible WebView URL.
- `src/pages/AuthCallback.tsx`
  - Use the stored raw callback URL.
  - Persistently skip already-completed callbacks.
  - Mark completion immediately after successful session installation.
  - Avoid repeated `replaceState` calls.
- `src/main.tsx`
  - Add a production-visible auth-flow diagnostic tag, because the current `authFlow=v9-callback-dedupe` log is dev-only and will not reliably appear in iOS production diagnostics.
- Approved. Proceed with this corrected plan.
  Two implementation notes:
  Do not rely solely on module-level memory for callback dedupe.
  Do not rely solely on fragile web storage long-term; if using sessionStorage/localStorage, keep it as a short-lived callback handoff/TTL guard only and make the flow resilient if storage is unavailable or cleared.
  Please implement:
  persistent callback fingerprint guard,
  no token fragment written into visible WebView URL before callback completes,
  clean handoff from deep link to /callback,
  idempotent AuthCallback,
  production-visible auth-flow version tag.
  Return:
  exact files changed,
  final auth-flow version tag,
  whether I must delete the app again before retesting.
Do I know what the issue is? Yes: the failing iOS app is not running the current `src/hooks/useDeepLinks.ts` code shown in the project context, or that branch is being bypassed before the new v10 handoff log can execute.

## Why this is not speculative

Your latest log repeatedly shows:

```text
deeplink:received
callback:start
callback:setSession-start
callback:setSession-success
```

But the current source code in `src/hooks/useDeepLinks.ts` should log this for every accepted callback before routing:

```text
deeplink:handoff-stored
```

That log is completely absent. Since the source code path currently does:

```text
deeplink:received
→ Browser.close attempt
→ storeCallbackHandoff(rawUrl)
→ deeplink:handoff-stored
→ navigate('/callback')
```

…the absence of `deeplink:handoff-stored` is hard evidence that either:

1. the iOS build is running an older bundled web asset, or
2. a different callback implementation is active at runtime, or
3. the currently shown source was not what was packaged into the installed app.

The `history.replaceState()` error is also consistent with the app still landing on:

```text
capacitor://localhost/callback#access_token=...
```

instead of the intended clean `/callback` handoff route.

## Full matching-file list from source search

### `/callback` and `/auth/callback`

- `src/App.tsx`
  - Active routes:
    - `/auth/callback` → `AuthCallback`
    - `/callback` → `AuthCallback`
- `src/contexts/AuthContext.tsx`
  - Builds email redirect to `/auth/callback`.
  - Detects `/auth/callback` and `/callback` so it does not sign out during verification.
- `src/lib/oauthFlowState.ts`
  - Comment only.
- `src/lib/authCallbackGuard.ts`
  - Normalizes native callback URLs into `/callback` or `/auth/callback`.
- `src/hooks/useDeepLinks.ts`
  - Native callback receiver and router.
- `src/pages/Auth.tsx`
  - Native Google OAuth uses `carnivorex://callback`.
  - Web/email auth uses `https://app.carnivorex.app/auth/callback`.
- `src/pages/AuthCallback.tsx`
  - Active callback screen for both callback routes.

### `setSession(`

- `src/pages/AuthCallback.tsx`
  - Relevant active native OAuth token branch:
    - `supabase.auth.setSession({ access_token, refresh_token })`
- `src/pages/ResetPassword.tsx`
  - Reset-password only, not this Google callback loop.
- `src/integrations/lovable/index.ts`
  - Managed web OAuth helper. Not the current native iOS manual Browser flow shown in your log.
- `src/lib/biometricAuth.ts`
  - Comment only.
- `src/contexts/AuthContext.tsx`
  - React state setter named `setSession`, not `supabase.auth.setSession`.

### `getLaunchUrl(`

- `src/hooks/useDeepLinks.ts`
  - Only source call.

### `appUrlOpen`

- `src/hooks/useDeepLinks.ts`
  - Only active listener.
- `src/App.tsx`, `src/pages/Auth.tsx`, `src/pages/AuthCallback.tsx`
  - Comments only.

### `replaceState(`

- `src/pages/AuthCallback.tsx`
  - Relevant callback cleanup call in `cleanAuthParamsFromUrl()`.
- `src/pages/ResetPassword.tsx`
  - Reset password only.
- `src/pages/MealPlan.tsx`
  - Meal-plan URL cleanup only.
- `src/hooks/useDeepLinks.ts`
  - Comment only.

### `navigate("/callback"` / `navigate('/callback'`

- No active literal matches found.
- The active source uses:

```text
navigate(parsed.normalizedPath, { replace: true })
```

inside `src/hooks/useDeepLinks.ts`.

## Active production code path according to source

```text
src/App.tsx
  BrowserRouter
    DeepLinkHandler
      useDeepLinks()
        CapApp.getLaunchUrl()
        routeAuthUrl(...)
        normalizeAuthCallbackUrl(...)
        storeCallbackHandoff(rawUrl)
        log: deeplink:handoff-stored
        navigate('/callback')

src/App.tsx routes
  /callback
    src/pages/AuthCallback.tsx
      consumeCallbackHandoff()
      finalize()
      supabase.auth.setSession(...)
      log: callback:setSession-success
```

## Plan to add hard-proof instrumentation only

I will make no auth logic changes in this pass. I will only add proof markers.

1. Add a single production-visible build constant:

```text
AUTH_FLOW_BUILD = v11-20260526-proof-path
```

2. Show that build value in all three places:

- AuthVerify diagnostics header.
- Startup AuthVerify diagnostics entry.
- Temporary callback screen UI, visible while the callback screen is loading.

3. Add this unmistakable log inside the exact active `useDeepLinks` auth-callback branch:

```text
PROOF_V11_USE_DEEPLINKS_ACTIVE_CALLBACK_BRANCH
```

with:

- build value
- source: `cold` or `live`
- normalized path
- fingerprint
- current visible URL redacted
- incoming callback URL redacted

4. Add this unmistakable log immediately before the exact `AuthCallback` token `setSession()` branch:

```text
PROOF_V11_AUTHCALLBACK_SETSESSION_BRANCH
```

with:

- build value
- fingerprint
- source URL redacted
- access token fingerprint
- refresh token fingerprint
- current visible path/search/hash flags

5. Add a startup marker early enough that even if the callback loop floods the 80-entry diagnostics buffer, the callback UI still visibly proves the build version.

6. After this build, the interpretation will be binary:

- If the callback UI or diagnostics show `AUTH_FLOW_BUILD = v11-20260526-proof-path`, then we know exactly which React source is active and can fix the loop from that path.
- If they do not show v11 after a clean rebuild, the iOS app is packaging stale web assets or building the wrong target/copy.

## Should you remove and re-add the iOS platform?

Not yet.

Based on the log, native deep linking is working and JavaScript is running. The problem is more likely stale packaged web assets or Xcode building a stale target/copy, not a broken iOS platform folder.

If v11 does not appear after the proof instrumentation and a clean build, then I would recommend this order:

1. targeted Capacitor/iOS cleanup and resync,
2. verify `ios/App/App/public` contains the new built assets,
3. clean Xcode DerivedData,
4. only then consider removing/re-adding the iOS platform if the packaged assets still cannot be trusted.

```xml
<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
</presentation-actions>
```

```xml
<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>
```
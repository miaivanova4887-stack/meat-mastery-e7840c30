# Fix Google Sign-In (Android + Web)

## What the logs show

Auth logs from the last few minutes (referrer: the published app) show every Google
attempt failing at the provider level:

```text
path: /authorize   status: 400
error: "missing OAuth secret"   error_code: validation_failed
```

This is not an app-code bug. The request reaches the auth server and is rejected
because the Google provider on this remixed project has no OAuth credentials
attached. Every sign-in attempt fails the same way, on native and on web.

## Why the remix caused it

Provider credentials are not copied when a project is remixed. The app code for
Google sign-in came across intact (native flow opens the provider URL in the
in-app browser, web flow uses the managed helper), but the backend provider entry
is empty, so the authorize call 400s before Google is ever shown.

## Fix

1. Attach managed Google credentials to this project's auth provider
   (managed social login configuration). This populates the client id/secret that
   the `missing OAuth secret` error is complaining about, for both the native
   direct-authorize path and the web managed path. Email/password stays enabled.
2. Confirm the redirect allow-list still contains the URLs this app uses:
   - `https://meat-mastery.lovable.app` and the custom domain `https://aos.carnivorex.app`
   - `https://aos.carnivorex.app/auth/callback` (Android App Link target)
   - the preview origin
3. Re-read the auth logs after one sign-in attempt and confirm `/authorize`
   returns a redirect to Google instead of 400.
4. No source files need to change for this fix. If step 3 still shows a failure,
   the next check is the native callback path in `useDeepLinks.ts` /
   `AuthCallback.tsx`, but the current evidence points only at provider config.

## After the fix

Google sign-in starts working immediately on web and in the already-installed
debug APK — no rebuild or new APK is required, because nothing in the bundled app
code changes.

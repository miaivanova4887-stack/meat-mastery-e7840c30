# Fix: Google login ends on the web page instead of returning to the app

## What is happening

Google sign-in itself now works. The problem is the final hop. The app asks the
auth server to send the user back to `carnivorex://callback`, but that custom
app scheme is **not** in the project's allowed redirect list (verified: the list
only contains `https://` web URLs). When a redirect target is not allowed, the
auth server silently falls back to the site web URL — so the Chrome tab lands on
the carnivorex web app (with the Lovable edit badge visible) and the native app
never receives the session.

## Fixes that did not work:

1. Add the native callback targets to the auth redirect allow-list:
  - `carnivorex://callback -- return error:`Invalid redirect: Must end with a public top-level domain (such as .com or .org).
  - `carnivorex://auth/callback` (legacy, kept for older installs) -- rIeturn error:Invalid redirect: Must end with a public top-level domain (such as .com or .org).
  - `carnivorex://**` (covers scheme variants Android may deliver) -- return error: invalid redirect: Cannot contain a wildcard (*).
2. Keep the existing web entries untouched so web sign-in and email confirmation
  links keep working.
3. Hide the "Edit with Lovable" badge on the published app so any web landing
  never shows Lovable branding.
4. Verify with a curl probe that the authorize endpoint accepts
  `redirect_to=carnivorex://callback` and returns a Google 302 whose state
   carries the custom scheme (not the web fallback).
5. You then retest on the phone — no rebuild needed, the change is server-side:
  force-close CarnivoreX, tap Continue with Google, confirm the browser tab
   closes by itself and the app shows you signed in.

## Notes

- No app code changes are expected. `src/pages/Auth.tsx` already requests
`carnivorex://callback` and `useDeepLinks` already consumes it.
- If after the allow-list change Google shows `redirect_uri_mismatch` again, that
is the Google console list (which must contain only
`https://<project>.supabase.co/auth/v1/callback`) and is unrelated to this fix.
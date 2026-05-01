The wrapped email link is now on the correct `app.carnivorex.app` host, so Android App Links are working. The remaining failure is inside the app: `AuthCallback` tries to `fetch()` the backend verification URL and follow the redirect, but auth verify redirects are not reliable to consume this way in a mobile WebView/browser context. The app ends up with no installed session, so it shows the stale “couldn’t confirm” state and the CTA repeats the same failing path.

Plan to fix it:

1. Update the email hook to wrap token data in an app-native callback URL
   - Continue sending visible links as `https://app.carnivorex.app/auth/callback?...` for signup/magic link/invite/email-change and `https://app.carnivorex.app/reset-password?...` for recovery.
   - Instead of only wrapping the entire backend `verify_url`, parse the backend verify URL and copy the important auth fields directly into the app URL:
     - `token` or `token_hash`
     - `type`
     - optional `email`
     - optional normalized `redirect_to`
   - Keep `verify_url` as a temporary backward-compatible fallback for any emails already sent.

2. Update `AuthCallback.tsx` to verify directly with the auth SDK
   - Detect `token` / `token_hash` + `type` in the URL.
   - Call `supabase.auth.verifyOtp(...)` directly from the app instead of `fetch(verify_url)`.
   - If a session is returned, explicitly install it with `supabase.auth.setSession(...)` when needed.
   - Refresh/read the user after verification and route home when `email_confirmed_at` is present.
   - Keep a fallback for older links that only contain `verify_url`, but parse the nested URL locally and then run the same direct verification path.
   - Make the CTA re-run this direct verification, so tapping it actually performs work instead of repeating a stale session refresh.

3. Update `ResetPassword.tsx` with the same direct verification pattern
   - For recovery links, parse `token` / `token_hash` + `type=recovery`.
   - Call `supabase.auth.verifyOtp(...)` to establish the recovery session.
   - Once verified, show the new-password form as it does today.
   - Preserve fallback handling for already-sent `verify_url` recovery emails.

4. Expand native deep-link routing
   - Update `useDeepLinks` so Android App Links to `/reset-password` are routed into React Router too, not only `/auth/callback`.
   - Keep search params and hash intact.

5. Update Android App Link intent filters for password reset
   - Add `/reset-password` to the Android manifest intent filters so recovery emails also open the installed app directly.

6. Deploy the updated auth email function
   - Deploy the changed `auth-email-hook` so future emails contain the direct token callback parameters.

Expected result:
- Fresh signup emails still start with `https://app.carnivorex.app/auth/callback`.
- Opening the email link in Android opens CarnivoreX directly.
- The app verifies the token itself, creates the session, and navigates into the app.
- The “Refresh verification status” screen should only appear for genuinely expired/invalid links, and its CTA will retry the actual token verification.
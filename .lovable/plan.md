I checked the runtime data available from Lovable first:

- Browser console snapshot: no `[AuthVerify]` entries were captured.
- Browser network snapshot: no `/auth/v1/...` verification request was captured.
- Backend auth logs for the latest test show the signup email was sent, then a later password login failed with `email_not_confirmed`; I do not see a verification request from the APK link tap.
- Email hook logs confirm the latest email link was generated correctly with `token_hash`, `type=signup`, `email`, and the original `verify_url`.

That means the missing evidence is inside the installed Android WebView/logcat, exactly as you said. I will make the next APK diagnostic-first, not another speculative auth behavior change.

Plan:

1. Add a small auth verification diagnostic recorder
   - Store redacted auth verification events in memory/localStorage for the current attempt.
   - Never store full tokens; only store length and first few chars.
   - Capture timestamps, route, query-param presence, token mode, and exact error fields.

2. Instrument the native deep-link path
   - In `useDeepLinks.ts`, record whether the auth URL arrived from:
     - `appUrlOpen` live link event
     - `CapApp.getLaunchUrl()` cold-start launch URL
     - normal web route load
   - Add the missing cold-start launch URL inspection so we can tell whether Android delivered the URL before the listener was attached.
   - Route matching auth/reset URLs through the same handler so the log clearly shows the source and target path.

3. Instrument `AuthCallback.tsx` around `verifyOtp()`
   - Log/display:
     - `[AuthVerify] parsed params`
     - `[AuthVerify] verifyOtp call mode=token_hash|token+email`
     - `[AuthVerify] verifyOtp result hasSession=... hasUser=...`
     - exact `error.name`, `error.status`, `error.code`, `error.message`
     - `getSession()` and `getUser()` after verification
   - Preserve the original callback URL in memory so the Retry button reuses the same parsed params even if `window.history.replaceState()` later clears the URL.
   - Do not change the verification strategy beyond diagnostics and cold-start URL capture.

4. Add an on-screen diagnostics panel on the “couldn’t confirm” and error states
   - Show a compact redacted diagnostic block directly in the APK screen.
   - Add a “Copy diagnostics” button so you can paste the exact runtime output here without needing Android Studio.
   - Keep the normal Retry and Back to sign in actions.

5. Mirror the same diagnostic pattern for reset-password verification
   - This ensures recovery links can be debugged with the same fields if needed.

6. After you approve and install the next APK, test one fresh signup link
   - Tap the email link from a killed app state once.
   - If it still lands on “couldn’t confirm,” tap “Copy diagnostics” and paste it here.
   - If you also want raw device logs, run:
     ```text
     adb logcat -c
     adb logcat -v time | grep --line-buffered -E "AuthVerify|ResetPassword|Capacitor/Console|Capacitor/App|chromium|GoTrue|supabase"
     ```
     Then tap the email link and paste the matching lines.

Expected outcome:
- We will know whether the URL arrived via live link or cold-start launch URL.
- We will know whether `verifyOtp()` was called at all.
- If it was called, we will have the exact auth error object or the exact success-without-session path.
- If it was not called, the diagnostics will show whether route/params were lost before `AuthCallback` ran.

<lov-actions>
<lov-open-history>View History</lov-open-history>
<lov-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</lov-link>
</lov-actions>
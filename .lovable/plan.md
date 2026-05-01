I found the likely root cause in `AuthCallback.tsx`: the callback URL now contains a long hex `token=...` copied from the backend confirmation URL. In that URL format, the value is the email link token hash, but the app currently passes it to `verifyOtp()` as a plain OTP token with `{ email, token, type }`. That is only correct for a 6-digit emailed OTP code. For email-link verification, the SDK should receive `{ token_hash, type }`.

Plan:

1. Fix callback token interpretation
   - In `AuthCallback.tsx`, update parsing so:
     - `token_hash` query param is used directly.
     - Long/non-6-digit `token` values from `ConfirmationURL` / `verify_url` are treated as `token_hash`.
     - Only true short numeric OTP codes use `{ email, token, type }`.
   - Preserve the original query params until verification is fully successful, so retry can reuse the same parsed token.

2. Normalize and verify the email type correctly
   - Use the parsed `type` from the link for the primary attempt (`signup` in your current link).
   - Add explicit safe handling for the newer documented `email` verification type if the backend returns that in future links.
   - Log the redacted verification inputs: whether `email` is present, whether `token_hash` is used, token length/fingerprint only, and the verification type.

3. Add exact error diagnostics
   - Log `verifyOtp()` failures with:
     - `error.name`
     - `error.status`
     - `error.code`
     - `error.message`
   - Do not log the full token.
   - Surface a clearer user-facing message for expired/invalid links while keeping full details in the console.

4. Handle all successful verification shapes
   - If `verifyOtp()` returns a session:
     - Confirm session fields exist.
     - Install/write the session explicitly if needed.
     - Call `getSession()` and `getUser()` afterward and log whether the user is confirmed.
     - Navigate into the app only after that re-fetch confirms a usable session/user.
   - If `verifyOtp()` returns a verified user but no session:
     - Treat verification as successful instead of falling into the stale state.
     - Show a success message and route the user to sign in, since there is no session to install.

5. Make retry deterministic
   - Ensure the retry CTA calls the same parse-and-verify function.
   - Ensure it does not clear the URL params before success.
   - Add a small retry log marker so we can confirm CTA taps actually rerun verification.

6. Update password reset with the same token-hash interpretation
   - Apply the same `token` vs `token_hash` parsing rule in `ResetPassword.tsx` so recovery links do not have the same hidden problem.
   - Add equivalent redacted verification/error logs for recovery.

7. Improve future email links from the hook
   - In `auth-email-hook`, put the parsed long confirmation token into `token_hash=` on the visible app link instead of only `token=`.
   - Optionally keep `token=` temporarily for backward compatibility, but the frontend will prefer `token_hash`.
   - Deploy the updated auth email function so new emails are unambiguous.

8. Optional native robustness
   - Add handling for Capacitor cold-start launch URLs via `getLaunchUrl()` in `useDeepLinks`, while keeping the existing `appUrlOpen` handling. This is not the main issue now, but it prevents similar failures when Android launches the app from a killed state.

Expected result:
- The current link shape (`https://app.carnivorex.app/auth/callback?token=...&type=signup&email=...`) will be interpreted correctly as an email-link token hash.
- `verifyOtp()` will be called with the correct SDK argument shape.
- If verification succeeds but returns no session, the app will no longer show “couldn’t confirm”; it will treat the email as confirmed and prompt sign-in.
- The console will show exact redacted verification inputs and returned error code/message if anything still fails.
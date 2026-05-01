I inspected the current code and the latest backend email-hook log. Two important findings:

1. The timestamp is only logged to logcat on app startup; `BuildStamp` exists but is not mounted anywhere in `App.tsx`, so it will not appear on screen.
2. The latest auth email hook log shows the custom email is building links with `token_hash=...` by promoting the backend verify URL's `token` value. That may be the root issue: depending on the email-hook payload/template, that `token` can be the confirmation token intended for `/auth/v1/verify`, not necessarily the `TokenHash` value expected by `verifyOtp({ token_hash })`. If so, the app is correctly calling `verifyOtp`, but with the wrong token representation.

Plan:

1. Mount an always-visible native debug build stamp
   - Import and render `BuildStamp` in `src/App.tsx` so the timestamp/fingerprint is visible in the APK UI.
   - Add the short build fingerprint alongside the timestamp so it is easy to compare with logcat and build output.
   - Keep it small and non-interactive, respecting the existing safe-area style.

2. Make AuthVerify diagnostics readable in Android logcat
   - Change `logAuthDiag()` in `src/lib/authDiagnostics.ts` to emit a single string:
     `console.info("[AuthVerify] <tag> <json>")`
   - This avoids Capacitor logging object payloads as `[object Object]` and makes grep output useful.
   - Include safe JSON fallback only; keep token redaction as currently implemented.

3. Auto-show diagnostics on the failure screen
   - In `AuthCallback.tsx`, automatically open and refresh the diagnostics panel when status becomes `stale` or `error`.
   - Display the redacted original callback URL in the panel so we can prove whether Android delivered the full URL via cold-start or live-link.
   - Keep the existing Copy button.

4. Fix the custom signup/recovery email link to prefer the real TokenHash from the email-hook payload
   - Update `supabase/functions/auth-email-hook/index.ts` so `buildEmailLink()` accepts the payload values for `token`, `token_hash`, and/or `token_hash`-equivalent fields when available, rather than relying only on parsing the backend verify URL.
   - For the visible app link, put the true TokenHash into `token_hash` when present.
   - Keep `verify_url` as a fallback for older clients.
   - Add backend logs that distinguish:
     - URL token present
     - payload token hash present
     - which source was used for the top-level `token_hash`
   - This directly tests/fixes the likely mismatch revealed by the backend log.

5. Ensure the backend auth email hook is redeployed
   - Deploy the updated `auth-email-hook` function after code changes so newly sent verification emails use the corrected link construction.
   - Existing email links may still fail; test with a newly generated signup/resend link after deployment.

6. Strengthen build-script verification
   - Add `BuildStamp` and the single-string diagnostic marker to `scripts/build-android-fresh.sh` marker checks so stale APKs fail before install.
   - Keep the existing marker checks for `callback:verifyOtp-call`, `deeplink:launch-url`, and `BuildInfo`.

After implementation, the next test should be:

```text
./scripts/build-android-fresh.sh
adb logcat -c
adb logcat -v time | grep --line-buffered -E 'BuildInfo|AuthVerify|auth-email-hook'
```

Then request a fresh verification email and tap the newest link. We should see:

```text
[BuildInfo] fingerprint=... ts=...
[AuthVerify] deeplink:launch-url ... or deeplink:appUrlOpen ...
[AuthVerify] callback:parsed ...
[AuthVerify] callback:verifyOtp-call {"mode":"token_hash",...}
[AuthVerify] callback:verifyOtp-result {"hasSession":...,"errCode":...,"errMessage":...}
```

This will either confirm success or finally expose the exact `verifyOtp()` runtime failure.
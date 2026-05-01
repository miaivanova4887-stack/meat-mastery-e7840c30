The new logs show two important facts:

1. The installed APK is still running an older JavaScript auth flow (`native deep link received`, `app resumed, refreshing session`, `session before refresh`) that no longer exists in the current source files.
2. The visible email link is now intercepted by Android correctly and lands on `/auth/callback` with `token_hash`, but the old callback code only calls `refreshSession()`. That fails with `AuthSessionMissingError` because there is no session yet. The callback must call `verifyOtp({ token_hash, type })` first.

Plan:

1. Make the Android build fail if it contains the old auth flow
   - Add stale-string rejection checks to `scripts/build-android-fresh.sh` for:
     - `native deep link received`
     - `app resumed, refreshing session`
     - `session before refresh`
     - `refreshSession error`
   - Keep required positive markers for the new flow:
     - `callback:verifyOtp-call`
     - `callback:verifyOtp-result`
     - `deeplink:launch-url`
     - `BuildInfo`
     - `build-version`
   - This prevents another APK from silently shipping the old refresh-only callback.

2. Make the installed app visibly and logcat-verifiably identify the new bundle
   - Ensure `BuildStamp` stays mounted.
   - Add a clearly searchable build marker to the app UI/logs, for example `authFlow=v2-verifyOtp`.
   - Update the script instructions so the first verification step is to launch the app and confirm `[BuildInfo] ... authFlow=v2-verifyOtp` appears in logcat.

3. Remove the last hardcoded wrong auth callback host in the app code
   - In `src/contexts/AuthContext.tsx`, `resolveAuthRedirect()` already returns `https://app.carnivorex.app/auth/callback`.
   - But the installed logs show signup used `https://carnivorex.app/auth/callback`, and `src/pages/Auth.tsx` has a separate resend path.
   - I will centralize or mirror the redirect helper so all signup/resend/password-reset paths use `https://app.carnivorex.app/...` consistently.

4. Harden `AuthCallback` against Android resume races
   - Do not call `refreshSession()` when there is no session just because the app resumed.
   - Keep the callback’s primary path as:
     - parse `token_hash` and `type`
     - call `supabase.auth.verifyOtp({ token_hash, type })`
     - only after success, call `getUser()` / navigate
   - Keep the fallback refresh only after the token path has been attempted, and log it as fallback only.

5. Check the auth email hook once more before redeploying if needed
   - The latest function logs still show `tokenHashSource: "url.token(promoted)"`, not `payload.token_hash`.
   - If Lovable Cloud’s auth email payload truly does not include `token_hash`, the current wrapped link still supplies a `token_hash` value equal to the backend verify token. The next implementation pass should either:
     - verify that `verifyOtp(token_hash)` accepts this exact value for email signup links in this setup, or
     - switch the app callback to consume `verify_url` as the primary path by opening/calling the backend verification URL in a controlled way, then returning to the app.
   - I will preserve redacted logging so the next test tells us exactly whether `verifyOtp-result` succeeds or reports `otp_expired` / invalid token.

After approval, I’ll apply these changes. Then rebuild with `npm run apk:fresh:debug` (or `bash scripts/build-android-fresh.sh`), install the APK, launch the app once, and check:

```text
adb logcat -c
adb logcat -v time | grep -E 'BuildInfo|AuthVerify|authFlow|verifyOtp-result|deeplink'
```

Expected first sign that the correct APK is installed:

```text
[BuildInfo] ... authFlow=v2-verifyOtp
```

Expected verification flow after tapping a fresh email link:

```text
[AuthVerify] deeplink:received ...
[AuthVerify] callback:parsed {"hasTokenHash":true,...}
[AuthVerify] callback:verifyOtp-call ...
[AuthVerify] callback:verifyOtp-result ...
```
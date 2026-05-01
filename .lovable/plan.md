## Root cause (confirmed from your full logs)

The APK on your device is running **stale JavaScript**, not the code we've been editing.

Evidence from `log1.applescript`:

- WebView bundle is `index-8x8C4lR1.js`.
- It emits `[AuthVerify] callback mount url=`, `[AuthVerify] session before refresh`, `[AuthVerify] refreshSession error`, `[AuthVerify] native deep link received url=`. **None of these strings exist in the current source.** The current `AuthCallback.tsx` emits `callback:start`, `callback:parsed`, `callback:verifyOtp-call`, `callback:verifyOtp-result`. The current `useDeepLinks.ts` emits `deeplink:appUrlOpen`, `deeplink:launch-url`.
- The bundle **never calls `verifyOtp` at all** — it only calls `refreshSession()`, which fails with `AuthSessionMissingError` because no session exists yet. That is exactly why every retry lands on the stale screen.
- The signup log line says `redirect= https://carnivorex.app/auth/callback` (apex), but the manifest is `app.carnivorex.app`. The token_hash promotion logic added 2 rounds ago is not present.

So the past three fixes are correct in source; they are simply not in the installed APK. There is nothing wrong with `verifyOtp`, the deep link, the manifest, or the edge function — they're all the right shape now. The device is running a build from before any of those landed.

## What to fix

### 1. Force a clean, verified rebuild (`scripts/build-android-fresh.sh`)

Audit the build script and make these guarantees explicit:

- `rm -rf dist android/app/src/main/assets/public`
- `npm run build` MUST run successfully before `npx cap sync android` (fail loudly if `dist/index.html` is older than the script start time).
- After `cap sync`, verify the synced bundle by `grep -l "callback:verifyOtp-call" android/app/src/main/assets/public/assets/index-*.js` — if no match, abort with a clear error.
- Print the synced bundle hash and filename at the end so you can compare with what the device loads.

### 2. Add a build fingerprint visible in logcat at app start (`src/main.tsx`)

Emit `console.info("[BuildInfo]", { commit, builtAt, bundle: import.meta.env.VITE_BUILD_ID })` on every cold start. Set `VITE_BUILD_ID` from the build script (e.g. `Date.now()`). Then one `adb logcat | grep BuildInfo` confirms which build is actually running before we debug anything else.

### 3. Re-pin install verification in the build script

After `./gradlew assembleDebug`, the script should:

- Print the APK SHA256 and absolute path.
- Run `adb install -r <apk>` and then `adb shell dumpsys package com.mi4labs.carnivorex | grep versionName` so the installed version is logged immediately.

### 4. Once the new APK is confirmed running

Tap the email link. With the current source code installed you will see:

```
[AuthVerify] callback:start url=...?token_hash=[redacted:56]...
[AuthVerify] callback:parsed hasTokenHash=true type=signup
[AuthVerify] callback:verifyOtp-call mode=token_hash
[AuthVerify] callback:verifyOtp-result hasSession=true|false errCode=...
```

Whatever that result line says is the real, narrow problem to fix next. We stop guessing.

## Files to edit

- `scripts/build-android-fresh.sh` — clean, build-or-fail, post-sync grep verification, APK SHA + version dump
- `src/main.tsx` — `[BuildInfo]` log on boot
- `vite.config.ts` — define `VITE_BUILD_ID` from `Date.now()` at build time

## What we are NOT doing

- No more changes to `AuthCallback.tsx`, `useDeepLinks.ts`, `auth-email-hook`, `AndroidManifest.xml`. The current source already contains the correct fixes; we just need to get them onto the device.

## After you rebuild and reinstall

1. `adb logcat | grep BuildInfo` — confirm the new build ID appears.
2. Trigger signup, tap the email link.
3. `adb logcat | grep AuthVerify` — paste the `callback:verifyOtp-result` line. That single line dictates the next (and likely final) fix.
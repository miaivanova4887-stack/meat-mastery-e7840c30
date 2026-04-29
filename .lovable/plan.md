## Diagnosis

All three symptoms share one root cause plus two minor secondary issues.

### Root cause: Android Auto Backup is restoring the WebView's localStorage on reinstall

`android/app/src/main/AndroidManifest.xml` line 5: `android:allowBackup="true"`. With this flag (and no `android:fullBackupContent` rules excluding the WebView data dir), Android silently restores `app_webview/Default/Local Storage/...` after an uninstall/reinstall on the same Google account. That means:

1. **Onboarding skipped** — `localStorage["carnivore-onboarding-complete"]` from a previous install is restored, so `isOnboardingComplete()` in `src/pages/Index.tsx` returns true and `<Navigate to="/onboarding">` never fires.
2. **Health Connect prompt never fires** — `HealthConnectContext` initializes `isConnected` from `localStorage["carnivore-hc-connected"] === "true"` (line 55–57). When restored as `true`, the auto-reconnect path runs `fetchHealthData()` directly and `requestPermissions()` is never called. Compounding this: there is currently **no explicit Health Connect prompt anywhere in the onboarding flow**; it only fires when the user manually navigates to `/progress/sync` and taps Connect.
3. **Push opt-in sheet never appears** — `setShowPushConsent(true)` is only reached at the end of onboarding step 11. Since onboarding is skipped (issue #1), step 11 never runs.

### Secondary issues

- The push sheet has no fallback entry point on native Android for users whose onboarding completed before push was added (or after restore). Today the only ways to land it are completing onboarding or going to Profile.
- HC `isConnected` is a cached truth flag, not a check against the OS. Even without the backup issue, an OS-level revoke would not be detected because the auto-reconnect path only calls `checkAvailability()`, not `requestPermissions()` / a real read.

## Plan

### 1. Stop Android from restoring web data across reinstalls (fixes all three on fresh install)

Edit `android/app/src/main/AndroidManifest.xml`:

- Set `android:allowBackup="false"` and `android:dataExtractionRules="@xml/data_extraction_rules"` (Android 12+) plus `android:fullBackupContent="@xml/backup_rules"` (older).
- Add `android/app/src/main/res/xml/backup_rules.xml` and `android/app/src/main/res/xml/data_extraction_rules.xml` that explicitly exclude `app_webview/`, `databases/`, and SharedPreferences. Disabling backup entirely is the safer default for a wellness app and matches the user's expectation that "uninstall = clean slate".

Result: the next fresh install starts with empty localStorage, so `isOnboardingComplete()` returns false → onboarding renders → step 11 → push sheet → (new) HC prompt.

### 2. Defensive client-side guards (so dev/QA reinstalls don't depend purely on backup config)

In `src/pages/Onboarding.tsx`:

- Replace `STORAGE_KEY` truth check with a versioned key: `carnivore-onboarding-complete-v2`. Anything set under the old key from a restored backup becomes irrelevant.
- Add `console.info("[Onboarding] mount step=", step, "completeFlag=", localStorage.getItem(...))` on first render.
- At the end of step 11 (in `saveProfile`), add `console.info("[Onboarding] step11 done — opening push consent sheet, native=", Capacitor.isNativePlatform())` before `setShowPushConsent(true)`.

In `src/pages/Index.tsx`:

- Add `console.info("[Index] gate: onboardingComplete=", isOnboardingComplete())` right before the `<Navigate>` check.

In `src/contexts/HealthConnectContext.tsx`:

- Bump key to `carnivore-hc-connected-v2` so any restored `true` from old key is ignored.
- Always **verify against the OS** on first mount on native: call `HealthConnect.checkAvailability()`; only keep `isConnected=true` if availability is `"available"` AND a no-op read succeeds (or a new lightweight `HealthConnect.hasPermissions()` if available — fall back to clearing the flag and forcing a re-prompt).
- Add `console.info("[HealthConnect] mount native=", Capacitor.isNativePlatform(), "cachedConnected=", cached, "availability=", status)`.

### 3. Add an explicit Health Connect prompt step inside onboarding (native Android only)

The user expects HC to prompt during onboarding. Currently there is no such prompt. Add a new conditional consent-style screen between step 11 (Wellness Disclaimer) and the push sheet, shown only when `Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android"`:

- Title: "Connect Health Connect"
- Body: brief explanation (steps, weight, heart rate, active calories) + "Skip" + "Connect"
- Connect calls `useHealthConnect().requestPermissions()` (already wired) and logs `console.info("[Onboarding] HC prompt result granted=", granted)`.
- Skip just continues. Either way, then opens the push consent sheet.

For non-Android (web / iOS), this step is hidden so the flow stays exactly: step 11 → push sheet (current behavior).

### 4. Make the push opt-in robust on Android 13+ and add logging

In `src/components/NotificationConsentSheet.tsx` and `src/lib/pushFcm.ts`:

- Log at every gate: `console.info("[Push] requestNativePush platform=", platform, "permResult=", perm.receive)`.
- After `PushNotifications.requestPermissions()` returns `granted`, also explicitly log token registration via the existing `registration` listener: `console.info("[Push] FCM token registered len=", t.value.length)` and `registrationError` failures already logged.
- The `@capacitor/push-notifications` plugin already maps `requestPermissions()` to the Android 13+ `POST_NOTIFICATIONS` runtime dialog when `targetSdk >= 33` and the manifest declares the permission — both already true. No code change needed for the dialog itself, just confirmation logs.

### 5. Add a safety net entry point for the push sheet (post-restore users)

In `src/pages/Index.tsx`, after the onboarding gate passes, on native Android only, check the user's `profiles.push_consent`. If it is `'unset'` AND `Capacitor.isNativePlatform()`, open `<NotificationConsentSheet />` once per session (gated by a `sessionStorage` flag so it never nags on every Home visit). Logs: `console.info("[Index] push_consent=", consent, "→ showSheet=", show)`.

This guarantees existing users (and anyone whose onboarding was restored from backup before the manifest fix lands) still get prompted.

### 6. Do not change unrelated logic

No edits to recipes, meal plan, CMS, subscription, auth, or the FCM edge functions. Migration is unchanged. Only the files listed below are touched.

## Files to change

```text
android/app/src/main/AndroidManifest.xml          (allowBackup=false + rules refs)
android/app/src/main/res/xml/backup_rules.xml      (new)
android/app/src/main/res/xml/data_extraction_rules.xml (new)
src/pages/Onboarding.tsx                           (versioned key, HC step, logs)
src/pages/Index.tsx                                (logs + post-restore push fallback)
src/contexts/HealthConnectContext.tsx              (versioned key, OS-verify, logs)
src/lib/pushFcm.ts                                 (extra console.info logs)
src/components/NotificationConsentSheet.tsx        (extra console.info logs)
```

## Verification (after rebuild + reinstall)

User runs `bash scripts/build-android-fresh.sh`, installs the APK, and watches `adb logcat | grep -E "Onboarding|HealthConnect|Push|Index"`. Expected sequence on a clean install:

```text
[Index] gate: onboardingComplete= false
[Onboarding] mount step= 0 completeFlag= null
... user taps through to step 11 ...
[Onboarding] step11 done — opening HC prompt, native= true
[HealthConnect] requestPermissions → granted= true
[Onboarding] step11 done — opening push consent sheet, native= true
[Push] requestNativePush platform= android permResult= granted
[Push] FCM token registered len= 163
```

If any line is missing, logcat tells us exactly which gate is short-circuiting.